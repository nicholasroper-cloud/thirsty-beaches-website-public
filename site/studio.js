/* Thirsty Beaches — Content Studio
   Writes captions from the real menu. No API, no key, works offline. */

/* Drink facts come from the menu page itself (/menu), so captions can't contradict it.
   The list below is an exact copy of a few menu rows, used only if /menu can't be read. */
let DRINKS = {
  'Dirty Sodas': [
    ['Thirst Trap', 'Dr Pepper, coconut, sweet cream'],
    ['Dirty Little Secret', 'Dr Pepper, coconut, fresh lime, coconut cream'],
    ['Sweet Cheeks', 'Coke, peach, coconut'],
    ["Tropic Like It's Hot", 'Sprite, pineapple, coconut, coconut cream'],
    ['Nice Coconuts', 'Coke, coconut, fresh lime, coconut cream'],
    ['Razzle My Berries', 'Sprite, raspberry, vanilla cream'],
    ['Sunset on the Rocks', 'Dr Pepper, raspberry, peach, coconut cream'],
    ['Peach Please', 'Sprite, peach, strawberry purée, coconut cream'],
    ['Upside-Down & Dirty', 'Dr Pepper, cherry, pineapple, coconut cream'],
    ['Pour Decisions', 'Build your own: pick the base, the syrup and the cream'],
  ],
  'Coffee': [
    ['Cappa-Cabana', 'Cappuccino'],
    ['Beach & Bothered', 'Caramel sea-salt latte'],
    ['Coco Loco Mocha', 'Coconut mocha, hot or iced'],
    ['Salted Caramel Cloud', 'Cold brew with salted caramel cold foam'],
    ['But First, Caffeine', 'Vanilla-coconut latte'],
    ['Wake & Shake', 'Iced latte, your pick of syrup'],
    ['Espresso Yourself', 'Single or double shot'],
    ["Beach S'mores", 'Hot chocolate, whipped cream, graham crumble'],
  ],
  'New Waves': [
    ['Spicy Señorita', 'Sprite, mango, mango purée, chamoy, Tajín rim'],
    ['Beach Buzz', 'Espresso tonic over ice with lime'],
    ['Pearl Diver', 'Lemonade with popping pearls'],
    ["Feelin' Frisky", 'Sprite, coconut, blue raspberry, fresh lime'],
    ['Low Tide', 'Coconut water with citrus'],
    ['Golden Hour', 'Orange soda, vanilla, sweet cream'],
  ],
  'Floats': [
    ['Thicc & Thirsty', 'Protein float'],
    ['Riptide', 'Red, white and blue layered float'],
    ['Sandy Bottom', 'Pineapple soft serve over your soda of choice'],
  ],
  'Soft Serve': [
    ['Swirl Power', 'Pineapple and vanilla soft serve, twisted'],
    ['Whip It Good', 'Soft serve loaded with every topping'],
    ['Pineapple Express', 'Classic pineapple soft serve'],
  ],
  'Beach Babies': [
    ['Cotton Candy Cloud', 'Lemonade, cotton candy, whipped cream'],
    ['Mermaid Splash', 'Lemonade, blue raspberry, whipped cream'],
    ['Sandcastle Shake', 'Vanilla soft-serve shake'],
    ['Beach Ball', 'Fruit punch with popping pearls'],
  ],
};

/* seasons, same rule as the menu: Fall Sep–Nov, Halloween Oct, Winter Dec–Feb, Valentine's Feb */
const SEASON_MONTHS = {fall:[9,10,11], halloween:[10], winter:[12,1,2], valentines:[2]};
(async function loadMenu(){
  try{
    const res = await fetch('/menu', {credentials:'same-origin'});
    if(!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const month = new Date().getMonth()+1, out = {};
    doc.querySelectorAll('.menu__sec').forEach(sec=>{
      if(sec.dataset.cat==='treats') return;            // candy bags aren't a drink post
      const cat = sec.querySelector('.menu__h')?.textContent.trim(); if(!cat) return;
      let inSeason = true;
      [...sec.children].forEach(el=>{
        if(el.matches('.menu__sub')){
          const m = SEASON_MONTHS[el.textContent.toLowerCase().replace(/[^a-z]/g,'')];
          inSeason = !m || m.includes(month);
        } else if(el.matches('.menu__grid') && inSeason){
          el.querySelectorAll('.row').forEach(r=>{
            const n = r.querySelector('.row__n')?.textContent.trim(), d = r.querySelector('.row__d')?.textContent.trim();
            if(n && d && d!=='Ask at the window') (out[cat] = out[cat] || []).push([n, d]);
          });
        }
      });
    });
    if(Object.keys(out).length) DRINKS = out;
  }catch(e){ /* offline: keep the copy above */ }
})();

const HOOKS = {
  drink: [
    'This one has a name we can\u2019t explain in polite company.',
    'You asked. We poured.',
    'Nobody orders just one of these.',
    'Warning: this becomes your order.',
    'The one you\u2019ll be thinking about at 3pm.',
    'Made to order. Gone in four minutes.',
  ],
  location: [
    'Trailer\u2019s up. Come find us.',
    'We\u2019re parked and pouring.',
    'Follow the neon.',
    'If you can see the trailer, you\u2019re close enough.',
  ],
  behind: [
    'What 4am looks like around here.',
    'Nobody sees this part.',
    'Restock day. Send help.',
    'How the sausage \u2014 sorry, soda \u2014 gets made.',
  ],
  loyalty: [
    'Ten drinks. Eleventh on us.',
    'Your phone is your punch card now.',
    'Free drink energy.',
  ],
  game: [
    'There\u2019s a secret game on our website.',
    'Beat 2,000 and the drink upgrade is on us.',
    'Yes, our website has an arcade. No, we won\u2019t explain.',
  ],
  weather: [
    'It\u2019s too hot to be doing anything else.',
    '{REGION} is not playing today.',
    'Heat index says: get a cold one.',
  ],
};

const CTA = {
  instagram: ['Link in bio for the full menu 🥤','Full menu + where we are: thirstybeaches.com',
              'Tap the link, build your own dirty soda.','See you at the window.'],
  tiktok:    ['Full menu on our site 🥤','Come find the trailer.','Which one are you ordering?'],
  facebook:  ['Full menu and today\u2019s location at thirstybeaches.com',
              'Come see us \u2014 we\u2019ll be here till we sell out.'],
};

const TAGS = {
  common: {
    instagram: ['#thirstybeaches','#dirtysoda','#dirtysodas','#softserve','#foodtruck','#drinktrailer',
      '#sodashop','#freezedriedcandy','#supportlocal'],
    tiktok: ['#dirtysoda','#thirstybeaches','#foodtruck','#sodatok','#fyp','#drinktok','#softserve'],
    facebook: ['#ThirstyBeaches','#DirtySoda','#SupportLocal'],
  },
  florida: {
    instagram: ['#gulfcoast','#tampaeats','#stpetefl','#sarasotaflorida','#naplesfl','#floridafoodie',
      '#stpeteeats','#tampabayeats','#floridalife'],
    tiktok: ['#floridacheck','#tampatok','#stpete'],
    facebook: ['#GulfCoast'],
  },
  utah: {
    instagram: ['#utah','#utaheats','#utahfoodie','#utahcounty','#lehiutah','#saltlakecity','#slceats','#wasatchfront'],
    tiktok: ['#utah','#utahtok','#slc'],
    facebook: ['#Utah','#UtahCounty'],
  },
};
const REGIONS = {
  both:    {name:'', where:'parked and pouring today', heat:'The heat'},
  utah:    {name:'Utah', where:'out on the Wasatch Front today', heat:'Utah'},
  florida: {name:'Florida', where:'out on the Gulf Coast today', heat:'Florida'},
};

const EMOJI = ['🥤','🌴','🌊','☀️','🍒','🍍','✨','🔥'];

const pick = a => a[Math.floor(Math.random()*a.length)];
const some = (a,n) => [...a].sort(()=>Math.random()-.5).slice(0,n);

let platform='instagram', angle='drink', region='both';

/* menu descriptions start with a capital; keep brand names, soften the rest mid-sentence */
const BRANDS = /^(Dr Pepper|Diet|Coke|Pepsi|Sprite|Mountain Dew|Fresca|Tajín)\b/;
const soften = d => BRANDS.test(d) ? d : d.charAt(0).toLowerCase()+d.slice(1);

function drinkLine(coldOnly){
  let cats = Object.keys(DRINKS).filter(c=>DRINKS[c].length);
  if(coldOnly) cats = cats.filter(c=>c!=='Coffee') ;
  const cat = pick(cats.length?cats:Object.keys(DRINKS));
  const [name, desc] = pick(DRINKS[cat]);
  return {cat, name, note: soften(desc)};
}

function build(){
  const d = drinkLine(angle==='weather');
  const R = REGIONS[region];
  const hook = pick(HOOKS[angle]).replace('{REGION}', R.heat);
  const cta = pick(CTA[platform]);
  const e = pick(EMOJI);
  let body;

  if (angle==='drink')
    body = `${hook}\n\nMeet the ${d.name} — ${d.note}. Built to order, like everything we pour.\n\n${cta} ${e}`;
  else if (angle==='location')
    body = `${hook}\n\nWe're ${R.where} with dirty sodas, soft serve and real espresso. The ${d.name} is going fast.\n\n${cta} ${e}`;
  else if (angle==='behind')
    body = `${hook}\n\nEvery ${d.name} starts hours before you order it — syrups made, ice packed, machines dialled in.\n\n${cta} ${e}`;
  else if (angle==='loyalty')
    body = `${hook}\n\nOpen thirstybeaches.com/card on your phone, add it to your home screen, and we'll punch it at the window. Ten drinks and the next one's free — start with a ${d.name}.\n\n${cta} ${e}`;
  else if (angle==='game')
    body = `${hook}\n\nCatch the little cup running around thirstybeaches.com and it opens a maze game. Break 2,000 points and show us the code for a free upsize.\n\n${cta} ${e}`;
  else
    body = `${hook}\n\nThe ${d.name} exists for days like this: ${d.note}.\n\n${cta} ${e}`;

  const n = platform==='instagram'?12:platform==='tiktok'?7:4;
  const pool = TAGS.common[platform].concat(region==='both'
    ? some(TAGS.utah[platform],3).concat(some(TAGS.florida[platform],3))
    : TAGS[region][platform]);
  const brand = pool.slice(0,2), rest = pool.slice(2);
  return { body, tags: brand.concat(some(rest, n-2)).join(' '), name:d.name };
}

function card(title, text, isTags){
  return `<div class="out"><h4>${title}<button type="button" data-copy>Copy</button></h4>
    <${isTags?'p class="tags"':'p'}>${text.replace(/</g,'&lt;')}</p></div>`;
}

function render(html){
  const r=document.getElementById('result');
  r.innerHTML=html;
  r.querySelectorAll('[data-copy]').forEach(b=>{
    b.onclick=async()=>{
      const box=b.closest('.out'), table=box.querySelector('table'), p=box.querySelector('p');
      const t=table
        ? [...table.querySelectorAll('tr')].slice(1).map(tr=>[...tr.cells].map(td=>td.innerText.replace(/\n+/g,' \u2014 ')).join(': ')).join('\n')
        : (p?p.innerText:'');
      try{ await navigator.clipboard.writeText(t); b.textContent='Copied'; }
      catch(e){ b.textContent='Copy failed'; }
      setTimeout(()=>b.textContent='Copy',1500);
    };
  });
}

document.getElementById('go').onclick=()=>{
  const a=build(), b=build();
  render(
    card('Option 1 · '+a.name, a.body) +
    card('Hashtags', a.tags, true) +
    card('Option 2 · '+b.name, b.body) +
    card('Hashtags', b.tags, true)
  );
};

document.getElementById('week').onclick=()=>{
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const plan=[
    ['drink','Post a drink — closeup, condensation, natural light'],
    ['behind','Behind the scenes — restock, prep, the machines'],
    ['location','Where you\u2019ll be — post it the morning of'],
    ['drink','Another drink — different category to Monday'],
    ['loyalty','Punch card reminder — show someone\u2019s card filling up'],
    ['weather','Weekend heat — the busiest post of the week'],
    ['game','The website game — good for shares'],
  ];
  let rows='';
  plan.forEach(([ang,note],i)=>{
    angle=ang; const p=build();
    rows+=`<tr><td>${days[i]}</td><td><b>${note}</b><br><span style="color:rgba(255,244,250,.6);font-size:.8rem">${p.body.split('\n')[0]}</span></td></tr>`;
  });
  angle='drink';
  document.querySelectorAll('#angle button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.a==='drink'?'true':'false'));
  render(`<div class="out"><h4>This week<button type="button" data-copy>Copy</button></h4>
    <table class="cal"><tr><th>Day</th><th>Post</th></tr>${rows}</table></div>`);
};

document.querySelectorAll('#platform button').forEach(b=>b.onclick=()=>{
  platform=b.dataset.p;
  document.querySelectorAll('#platform button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
});
document.querySelectorAll('#angle button').forEach(b=>b.onclick=()=>{
  angle=b.dataset.a;
  document.querySelectorAll('#angle button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
});

/* region: Utah, Florida or both (no Florida-only captions) */
(function(){
  const angleRow=document.getElementById('angle'); if(!angleRow) return;
  const row=document.createElement('div'); row.className='pick'; row.id='region';
  row.setAttribute('role','group'); row.setAttribute('aria-label','Region');
  [['both','Utah + Florida'],['utah','Utah'],['florida','Florida']].forEach(([k,label])=>{
    const b=document.createElement('button'); b.type='button'; b.dataset.r=k; b.textContent=label;
    b.setAttribute('aria-pressed',k===region?'true':'false');
    b.onclick=()=>{ region=k; row.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false')); };
    row.appendChild(b);
  });
  angleRow.after(row);
})();
