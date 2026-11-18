/* Thirsty Beaches — THIRSTY MAZE arcade */
(function(){
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* phones and tablets: the cup only runs the side walls, between the sticky nav and the
     bottom of the screen (toasts, install prompt, browser toolbar), and ducks out of sight
     between runs, so it never sits on top of a button or a form field */
  const TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;
  /* the roaming cup is pure flourish and stays gated behind reduced-motion (and CSS
     also hides it, belt and suspenders) — but the maze itself, the footer link and the
     #play deep link must keep working, so the module no longer bails out entirely */

  /* ── the roaming cup ─────────────────────────────── */
  let runner = null;
  if (!REDUCED){
    runner = document.createElement('button');
    runner.className = 'runner';
    runner.setAttribute('aria-label', 'A runaway drink is loose — ' + (TOUCH ? 'tap' : 'click') + ' to catch it');
    if (TOUCH) runner.classList.add('runner--away');
    runner.innerHTML = `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <g class="lid"><rect x="7" y="4" width="18" height="4" rx="1.5" fill="#FF2D95"/>
        <rect x="14" y="0" width="3" height="5" rx="1" fill="#00F0FF"/></g>
      <path d="M8 9 h16 l-2 15 a3 3 0 0 1 -3 2.6 h-6 a3 3 0 0 1 -3 -2.6 z" fill="#1225B8" stroke="#75E9FF" stroke-width=".75"/>
      <path d="M10.2 21.1l12.5-5.4-.5 3.3-11.7 5.1z" fill="#FF2DAD"/>
      <path d="M11 25l11-4.8-.2 1.3-9.6 4.2z" fill="#00E5FF"/>
      <circle cx="12" cy="18" r=".75" fill="none" stroke="#98F4FF" stroke-width=".55"/>
      <circle cx="20" cy="15.5" r=".65" fill="none" stroke="#FFB3ED" stroke-width=".55"/>
      <circle cx="13.5" cy="12.5" r="1.1" fill="#F7F2FF"/>
      <circle cx="18.5" cy="12.5" r="1.1" fill="#F7F2FF"/>
      <rect class="leg"      x="11" y="26" width="3.4" height="5" rx="1.6" fill="#FF2D95"/>
      <rect class="leg leg--b" x="17.6" y="26" width="3.4" height="5" rx="1.6" fill="#FF2D95"/>
    </svg>`;
    document.body.appendChild(runner);
  }

  let raf = null;
  const M = 14;                                     // margin from the page edge

  /* travel the four edges of the viewport, like a lap of the screen */
  function legs(){
    const w = innerWidth, h = innerHeight, s = runner.offsetWidth || 64;
    if (TOUCH){
      const nav = document.querySelector('.nav');
      const top = Math.round((nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0) + 16);
      const bottom = h - s - 110;
      if (bottom - top < 240) return [];             // landscape phone: not enough wall to run
      const e = 2;                                    // hug the wall, inside the page gutter
      const O = 90;                                   // .runner is parked at left/top:-90px in CSS
      return [
        { from:[w - s - e + O, bottom + O], to:[w - s - e + O, top + O], flip: 1, rot: -90 },  // up the right
        { from:[e + O, top + O],            to:[e + O, bottom + O],      flip: 1, rot:  90 },  // down the left
      ];
    }
    return [
      { from:[-s, h - s - M],      to:[w - s - M, h - s - M], flip: 1, rot:   0 }, // along the bottom
      { from:[w - s - M, h - s - M], to:[w - s - M, M],       flip: 1, rot: -90 }, // up the right
      { from:[w - s - M, M],       to:[M, M],                 flip:-1, rot:   0 }, // back along the top
      { from:[M, M],               to:[M, h - s - M],         flip: 1, rot:  90 }, // down the left
    ];
  }

  let leg = 0;
  function dash(){
    const Ls = legs();
    if (!Ls.length || (TOUCH && typing())){ schedule(); return; }
    const L = Ls[leg % Ls.length];
    leg++;
    const dur = TOUCH ? 3600 + Math.random() * 1800 : 5200 + Math.random() * 2600;
    const stopAt = 0.35 + Math.random() * 0.3;   // where it pauses to show off
    let didTrick = false, held = 0, holding = false;
    const t0 = performance.now();
    cancelAnimationFrame(raf);

    const place = (k) => {
      const x = L.from[0] + (L.to[0] - L.from[0]) * k;
      const y = L.from[1] + (L.to[1] - L.from[1]) * k;
      runner.style.setProperty('--x', x + 'px');
      runner.style.setProperty('--y', y + 'px');
      runner.style.setProperty('--flip', L.flip);
      runner.style.setProperty('--rot', L.rot + 'deg');
    };

    if (TOUCH){ place(0); requestAnimationFrame(() => runner.classList.remove('runner--away')); }

    (function step(t){
      if (paused) return;
      if (TOUCH && typing()){ runner.classList.add('runner--away'); schedule(); return; }
      const k = Math.min(1, (t - t0 - held) / dur);

      if (!didTrick && !holding && k >= stopAt && Math.random() < 0.8){
        holding = true;
        const pauseStart = t;
        place(k);
        perform(() => {
          held += performance.now() - pauseStart;
          holding = false; didTrick = true;
          raf = requestAnimationFrame(step);
        });
        return;
      }
      if (holding) return;

      place(k);
      if (k < 1) raf = requestAnimationFrame(step);
      else { if (TOUCH) runner.classList.add('runner--away'); schedule(); }
    })(t0);
  }
  /* keyboard up on a phone: stay out of the way */
  function typing(){
    const a = document.activeElement;
    return !!a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
  }
  let paused = false, timer = null;

  /* little bits it performs when it stops */
  const TRICKS = ['moonwalk','spin','wiggle','peek','trip','breakdance','wave'];
  let lastTrick = -1;

  function perform(after){
    let i; do { i = Math.floor(Math.random()*TRICKS.length); } while (i === lastTrick);
    lastTrick = i;
    const trick = TRICKS[i];
    runner.dataset.trick = trick;
    const ms = trick === 'breakdance' ? 2200 : trick === 'trip' ? 1400 : 1600;
    setTimeout(() => { delete runner.dataset.trick; after && after(); }, ms);
  }

  function schedule(){
    const rest = TOUCH ? 7000 + Math.random() * 8000 : 2200 + Math.random() * 3500;
    timer = setTimeout(() => { if (!paused && !document.hidden) dash(); else if (!paused) schedule(); }, rest);
  }
  function pauseRunner(){
    if (!runner) return;
    paused = true; clearTimeout(timer); cancelAnimationFrame(raf);
    delete runner.dataset.trick;
    if (TOUCH) runner.classList.add('runner--away');   // comes back fresh on its next run
    runner.style.display = 'none';
  }
  function resumeRunner(){
    if (!runner) return;
    paused = false; runner.style.display = ''; schedule();
  }

  /* first lap shortly after the page settles */
  if (runner) setTimeout(dash, 1800);

  /* ══ THIRSTY MAZE v2 ═══════════════════════════════
     Eat the menu. Dodge the chains. One maze a day, same for everyone. */

  const DRINKS = [["Butter Me Up","Dirty Sodas"],["Cake Walk","Dirty Sodas"],["Cherry on Top","Dirty Sodas"],["Cran-Do Attitude","Dirty Sodas"],["Dew or Die","Dirty Sodas"],["Dirty Little Secret","Dirty Sodas"],["Fling on the Beach","Dirty Sodas"],["Fruit Loop Lagoon","Dirty Sodas"],["Guava Lava","Dirty Sodas"],["Hula Hottie","Dirty Sodas"],["Just Beachy","Dirty Sodas"],["Nice Coconuts","Dirty Sodas"],["No Regrets","Dirty Sodas"],["One in a Melon","Dirty Sodas"],["Peach Please","Dirty Sodas"],["Pink Bikini","Dirty Sodas"],["Pour Decisions","Dirty Sodas"],["Razzle My Berries","Dirty Sodas"],["Salt Life","Dirty Sodas"],["Shark Bait","Dirty Sodas"],["Sunset on the Rocks","Dirty Sodas"],["Sweet Cheeks","Dirty Sodas"],["Tan Lines","Dirty Sodas"],["Thirst Trap","Dirty Sodas"],["Tropic Like It's Hot","Dirty Sodas"],["Upside-Down & Dirty","Dirty Sodas"],["Apple of My Thighs","Seasonal"],["Cider Beaches","Seasonal"],["Fall Back & Relax","Seasonal"],["Gourd Vibes Only","Seasonal"],["Harvest Moon","Seasonal"],["Hayride Hottie","Seasonal"],["Pumpkin Spice & Everything Dirty","Seasonal"],["Spice Spice Beachy","Seasonal"],["Sweater Weather","Seasonal"],["Boo-tea Call","Seasonal"],["Ghosted","Seasonal"],["The Graveyard Shift","Seasonal"],["Witch Better Have My Candy","Seasonal"],["Frosty the Snowcone","Seasonal"],["Jingle Juice","Seasonal"],["Naughty & Nice","Seasonal"],["Sleigh All Day","Seasonal"],["Crush On You","Seasonal"],["Love Potion No. 9","Seasonal"],["Berry Breezy","Refreshers"],["Cannonball","Refreshers"],["Flamingle","Refreshers"],["Mango Tango","Refreshers"],["Rash Guard","Refreshers"],["Spa Day","Refreshers"],["Unsinkable","Refreshers"],["Basic Beach","Coffee"],["Beach & Bothered","Coffee"],["Beach Drip","Coffee"],["Beach S'mores","Coffee"],["But First, Caffeine","Coffee"],["Cappa-Cabana","Coffee"],["Cloud Nine","Coffee"],["Coco Loco Mocha","Coffee"],["Espresso Yourself","Coffee"],["Hot Mess","Coffee"],["Salted Caramel Cloud","Coffee"],["Wake & Shake","Coffee"],["Beach Buzz","New Waves"],["Beach Sting","New Waves"],["Castaway","New Waves"],["Feelin' Frisky","New Waves"],["Golden Hour","New Waves"],["Lazy River","New Waves"],["Low Tide","New Waves"],["Pearl Diver","New Waves"],["Spicy Señorita","New Waves"],["Sunburn","New Waves"],["Wipeout","New Waves"],["Easy, Tiger","Lemonades"],["Kiss & Tell","Lemonades"],["Main Squeeze","Lemonades"],["Pink Flamingo","Lemonades"],["When Life Gives You Beaches","Lemonades"],["Feelin' Blue","Italian Sodas"],["Fizzy Business","Italian Sodas"],["La Dolce Beach","Italian Sodas"],["Adios, Beaches","Rescue – Energy Drinks"],["Cloud Surfer","Rescue – Energy Drinks"],["Lemon Drop Kick","Rescue – Energy Drinks"],["Passion Pit","Rescue – Energy Drinks"],["Peach Out","Rescue – Energy Drinks"],["Piña Collider","Rescue – Energy Drinks"],["Rise & Grind","Rescue – Energy Drinks"],["Skinny Dippin'","Rescue – Energy Drinks"],["Wet & Wild","Rescue – Energy Drinks"],["Wired & Tired","Rescue – Energy Drinks"],["Float On","Soft Serve"],["Pineapple Express","Soft Serve"],["Swirl Power","Soft Serve"],["Vanilla Vibes","Soft Serve"],["Whip It Good","Soft Serve"],["Build Your Own Float","Floats"],["Cold Shoulder","Floats"],["Riptide","Floats"],["Sandy Bottom","Floats"],["Thicc & Thirsty","Floats"],["Beach Ball","Beach Babies"],["Cotton Candy Cloud","Beach Babies"],["Lil' Root Beer Float","Beach Babies"],["Lil' Squirt","Beach Babies"],["Mermaid Splash","Beach Babies"],["Sandcastle Shake","Beach Babies"],["Sharky","Beach Babies"],["Shore Temple","Beach Babies"],["Freeze-Dried Candy — Large","Treats"],["Freeze-Dried Candy — Medium","Treats"],["Freeze-Dried Candy — Small","Treats"]];
  const CATC = { 'Dirty Sodas':'#FF3CAC','Floats':'#FFD166','Soft Serve':'#FFF4FA','Coffee':'#C9865A',
    'Lemonades':'#F9F871','Refreshers':'#5EE3B0','Italian Sodas':'#8A3FFC','New Waves':'#2AF5E4',
    'Rescue – Energy Drinks':'#7CFF4F','Seasonal':'#FF9A4D','Beach Babies':'#FF9ECF','Treats':'#FFB4A2' };
  const CHAINS = ['Big Chain','Copycat','Franchise','Knockoff'];

  /* seasonal skins, picked by today's date */
  function skin(){
    const d=new Date(), m=d.getMonth()+1, day=d.getDate();
    if (m===10) return {id:'halloween',title:'HAUNTED MAZE',wall:'#FF7A1A',bg:'#140226',pellet:'#B6FF3D',pelletName:'pumpkin swirl',ghost:'#2b2b2b',foot:'eat the menu · pumpkin swirl = payback time'};
    if (m===12 || (m===1&&day<7)) return {id:'winter',title:'FROZEN MAZE',wall:'#7FDBFF',bg:'#061a33',pellet:'#FFFFFF',pelletName:'snow cone',ghost:'#3a4a6b',foot:'eat the menu · snow cone = payback time'};
    if (m===2 && day<=15) return {id:'valentine',title:'LOVE MAZE',wall:'#FF5C8A',bg:'#2a0414',pellet:'#FFD1DC',pelletName:'strawberry swirl',ghost:'#5a1f3a',foot:'eat the menu · strawberry swirl = payback time'};
    return {id:'summer',title:'THIRSTY MAZE',wall:'#8A3FFC',bg:'#12032E',pellet:'#FFF4FA',pelletName:'soft serve',ghost:'#6b6b7b',foot:'eat the menu · soft serve = payback time'};
  }
  const SK = skin();

  /* seeded random: everyone gets the same maze today */
  const DAY = (d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date());
  function rng(seed){ let h=1779033703^seed.length; for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
    return function(){ h=Math.imul(h^(h>>>16),2246822507); h=Math.imul(h^(h>>>13),3266489909); h^=h>>>16; return (h>>>0)/4294967296; }; }

  const W = 19, H = 19, S = 24;
  /* 0 path·drink  1 wall  2 empty path  3 power */
  function genMaze(seed){
    const R = rng(seed);
    const g = Array.from({length:H},()=>Array(W).fill(1));
    /* carve a spanning tree on the odd cells of the LEFT half (cols 1..9), then mirror */
    const cols = 5, rows = 9;  // odd columns 1,3,5,7,9 ; odd rows 1..17
    const seen = Array.from({length:rows},()=>Array(cols).fill(false));
    const stack=[[0,0]]; seen[0][0]=true; g[1][1]=0;
    while(stack.length){
      const [cx,cy]=stack[stack.length-1];
      const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[cx+dx,cy+dy]).filter(([x,y])=>x>=0&&x<cols&&y>=0&&y<rows&&!seen[y][x]);
      if(!nb.length){ stack.pop(); continue; }
      const [nx,ny]=nb[(R()*nb.length)|0]; seen[ny][nx]=true;
      g[ny*2+1][nx*2+1]=0; g[cy*2+1+(ny-cy)][cx*2+1+(nx-cx)]=0; stack.push([nx,ny]);
    }
    /* open extra walls for loops: a maze with dead ends is no fun with ghosts */
    for(let y=1;y<H-1;y++) for(let x=1;x<=9;x++) if(g[y][x]===1 && ((x%2)^(y%2)) && R()<0.38){
      const a = x%2 ? [g[y-1][x],g[y+1][x]] : [g[y][x-1],g[y][x+1]];
      if(a[0]!==1 && a[1]!==1) g[y][x]=0;
    }
    /* centre lane across the mirror line + ghost pen */
    for(let y=1;y<H-1;y++) if(y%2) g[y][9]=0;
    for(let y=8;y<=10;y++) for(let x=8;x<=10;x++) g[y][x]=2;
    g[7][9]=0; g[11][9]=0;
    /* side tunnel on the middle row */
    g[9][0]=2; g[9][1]=0;
    /* mirror */
    for(let y=0;y<H;y++) for(let x=0;x<9;x++) g[y][W-1-x]=g[y][x];
    /* power pellets in the four inner corners */
    [[1,1],[17,1],[1,17],[17,17]].forEach(([x,y])=>g[y][x]=3);
    return g;
  }

  /* ── overlay ─────────────────────────────────────── */
  const wrap = document.createElement('div');
  wrap.className = 'arcade skin-'+SK.id;
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', SK.title);
  wrap.innerHTML = `
    <button class="arcade__close" type="button">${TOUCH ? 'Close' : 'Esc &middot; Close'}</button>
    <div class="arcade__box">
      <h2 class="arcade__title">${SK.title}</h2>
      <div class="arcade__hud"><span id="mzScore">Score 0</span><span id="mzBest"></span><span id="mzLives">&#129380;&#129380;&#129380;</span></div>
      <div class="arcade__screen">
        <canvas id="maze" width="${W*S}" height="${H*S}"></canvas>
        <div class="attract" id="mzAttract">
          <div class="attract__logo">${SK.title}</div>
          <div class="attract__sub">EAT THE MENU &middot; DODGE THE CHAINS</div>
          <div class="attract__coin">INSERT COIN</div>
          <button class="attract__start" type="button" id="mzStart">PRESS START</button>
          <div class="attract__day">MAZE OF THE DAY &middot; ${DAY}</div>
        </div>
      </div>
      <p class="arcade__drink" id="mzDrink">&nbsp;</p>
      <div class="dpad" id="mzPad" aria-label="Move">
        <button type="button" data-d="0,-1" aria-label="Up">&#9650;</button>
        <button type="button" data-d="-1,0" aria-label="Left">&#9664;</button>
        <button type="button" data-d="1,0" aria-label="Right">&#9654;</button>
        <button type="button" data-d="0,1" aria-label="Down">&#9660;</button>
      </div>
      <p class="arcade__msg" id="mzMsg"></p>
      <div id="mzBoard" class="board"></div>
      <p class="arcade__foot">Arrows / WASD &middot; swipe or D-pad on touch &middot; grab the bonus drink for 300 &middot; ${SK.foot}<br>Break <b>500</b> for the weekly free-drink draw &middot; <b>2,000</b> wins a free upsize &middot; <button type="button" class="arcade__mute" id="mzMute">sound on</button></p>
    </div>`;
  document.body.appendChild(wrap);

  const canvas = wrap.querySelector('#maze');
  const ctx = canvas.getContext('2d');
  const $ = id => wrap.querySelector('#'+id);

  /* ── 8-bit sound (WebAudio, only after a gesture) ── */
  let AC=null, muted = (()=>{ try{ return localStorage.getItem('tb-mute')==='1'; }catch(e){ return false; } })();
  function beep(f, ms, type, vol){
    if (muted) return;
    try{
      AC = AC || new (window.AudioContext||window.webkitAudioContext)();
      const o=AC.createOscillator(), g=AC.createGain();
      o.type=type||'square'; o.frequency.value=f; g.gain.value=vol||.05;
      o.connect(g); g.connect(AC.destination); o.start();
      g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime+ms/1000); o.stop(AC.currentTime+ms/1000);
    }catch(e){}
  }
  const sfx = {
    coin(){ beep(988,90); setTimeout(()=>beep(1319,220),90); },
    munch(){ beep(220+Math.random()*60,40,'triangle',.025); },
    power(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,90),i*70)); },
    ghost(){ [1047,784,1047,1319].forEach((f,i)=>setTimeout(()=>beep(f,70),i*60)); },
    die(){ [440,370,311,262,220].forEach((f,i)=>setTimeout(()=>beep(f,140,'sawtooth',.04),i*120)); },
    bonus(){ [784,988,1175,1568].forEach((f,i)=>setTimeout(()=>beep(f,80,'square',.06),i*55)); },
    win(){ [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>beep(f,120),i*90)); }
  };
  $('mzMute').onclick = () => { muted=!muted; try{localStorage.setItem('tb-mute',muted?'1':'0');}catch(e){} $('mzMute').textContent = muted?'sound off':'sound on'; };
  $('mzMute').textContent = muted?'sound off':'sound on';

  /* ── state ───────────────────────────────────────── */
  /* Classic maze-chase rules: smooth movement, ghosts a touch slower than you,
     four ghost personalities, scatter/chase cycles, frightened mode, eyes that run home,
     side tunnels, READY! pause, death animation, levels. */
  const TUNNEL_Y = 9, PEN = {x:9, y:9}, DOOR = {x:9, y:7};
  const CORNERS = [[W-2,0],[1,0],[W-2,H-1],[1,H-1]];                 // scatter targets: one corner each
  const GCOL = ['#8A8A99','#6E6E80','#9A9AAE','#7C7C90'];   // the chains: four shades of corporate grey
  const GNAME = CHAINS;
  let MAPSRC, map, dots, dotsEaten, score, lives, level, player, ghosts, playing=false, loopId=null, wallLayer=null;
  let grace, tally, drank, startT, pops, flash = 0, bonus = null, bonusShown, pool = [], sips = 0;
  let mode, modeIdx, modeT, fright, frightFlash, ghostStreak, phase, phaseT, dyingT, nextLifeAt;
  let bonusSpawned = false;

  const LEVELS = [ // player, ghost, fright (tiles/sec), fright seconds, scatter/chase schedule
    {p:5.6, g:4.9, f:2.9, fs:7, sched:[7,20,7,20,5,20,5,1e9]},
    {p:6.0, g:5.4, f:3.2, fs:6, sched:[7,20,7,20,5,1033,.02,1e9]},
    {p:6.3, g:5.8, f:3.4, fs:5, sched:[7,20,7,20,5,1033,.02,1e9]},
    {p:6.6, g:6.2, f:3.6, fs:4, sched:[5,20,5,20,5,1037,.02,1e9]},
  ];
  const LV = () => LEVELS[Math.min(level-1, LEVELS.length-1)];

  function reset(full){
    if (full){
      MAPSRC = genMaze(DAY);
      const R = rng(DAY+':drinks'); pool = DRINKS.slice();
      for (let i=pool.length-1;i>0;i--){ const j=(R()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
      window.__pool = pool;
      score = 0; lives = 3; level = 1; tally = {}; drank = []; startT = performance.now(); sips = 0; nextLifeAt = 10000;
      newLevel();
    }
    positions();
  }
  const LEVEL_WALLS = [null, '#2AF5E4', '#FF3CAC', '#FFD166', '#8A3FFC', '#7CFF4F'];
  const wallCol = () => LEVEL_WALLS[(level-1) % LEVEL_WALLS.length] || SK.wall;
  function newLevel(){
    /* a fresh maze every level, still the same for everyone today */
    MAPSRC = genMaze(level === 1 ? DAY : DAY + ':L' + level);
    if (wallLayer) bakeWalls();
    map = MAPSRC.map(r=>r.slice());
    dots = 0; for (const r of map) for (const v of r) if (v===0||v===3) dots++;
    dotsEaten = 0; bonusShown = 0;
  }
  function positions(){
    const ps = open(9,17) ? [9,17] : [9,15];
    player = { x:ps[0]*S+S/2, y:ps[1]*S+S/2, dx:-1, dy:0, nx:-1, ny:0, anim:0, eating:0 };
    ghosts = [
      { n:0, x:9*S+S/2,  y:7*S+S/2, dx:-1, dy:0, state:'out',  col:GCOL[0] },           // Big Chain starts above the pen
      { n:1, x:9*S+S/2,  y:9*S+S/2, dx:0,  dy:-1, state:'pen', col:GCOL[1], free:0 },    // Copycat leaves at once
      { n:2, x:8*S+S/2,  y:9*S+S/2, dx:0,  dy:1,  state:'pen', col:GCOL[2], free:30 },   // Franchise after 30 dots
      { n:3, x:10*S+S/2, y:9*S+S/2, dx:0,  dy:1,  state:'pen', col:GCOL[3], free:60 },   // Knockoff after 60 dots
    ];
    mode = 'scatter'; modeIdx = 0; modeT = LV().sched[0]; fright = 0; ghostStreak = 0; pops = []; flash = 0; bonus = null; bonusSpawned = false;
    phase = 'ready'; phaseT = 2.0; dyingT = 0;
    $('mzDrink').innerHTML = '&nbsp;';
    hud();
  }
  function hud(){
    $('mzScore').textContent = 'Score ' + score;
    $('mzBest').textContent = (best() ? 'Best ' + best() + ' · ' : '') + 'Level ' + level;
    $('mzLives').innerHTML = '\u{1F964}'.repeat(Math.max(0, lives - 1));
  }
  function msg(t){ $('mzMsg').textContent = t; }

  const at = (x, y) => { if (y === TUNNEL_Y && (x < 0 || x >= W)) return 2; return (map[y] && map[y][x] !== undefined) ? map[y][x] : 1; };
  const open = (x, y) => at(x, y) !== 1;
  const tileOf = e => [Math.floor(e.x / S), Math.floor(e.y / S)];
  const centred = e => Math.abs(e.x - (Math.floor(e.x/S)*S + S/2)) < .6 && Math.abs(e.y - (Math.floor(e.y/S)*S + S/2)) < .6;

  /* ── controls ────────────────────────────────────── */
  function dir(dx,dy){ player.nx=dx; player.ny=dy; }
  function tryTurn(e){
    const k = e.key.toLowerCase();
    const m = { arrowup:[0,-1], w:[0,-1], arrowdown:[0,1], s:[0,1], arrowleft:[-1,0], a:[-1,0], arrowright:[1,0], d:[1,0] };
    if (m[k]){ dir(...m[k]); e.preventDefault(); }
    if (k === 'escape') close();
  }
  let tx = 0, ty = 0;
  canvas.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, {passive:true});
  canvas.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx)<8 && Math.abs(dy)<8) return;
    if (Math.abs(dx) > Math.abs(dy)) dir(Math.sign(dx),0); else dir(0,Math.sign(dy));
  }, {passive:true});
  $('mzPad').querySelectorAll('button').forEach(b=>{
    const [dx,dy]=b.dataset.d.split(',').map(Number);
    b.addEventListener('pointerdown', e=>{ e.preventDefault(); dir(dx,dy); });
  });

  /* ── simulation (dt in seconds) ──────────────────── */
  function moveAlong(e, speed, dt, onCentre){
    /* advance along e.dx/e.dy by speed tiles/sec. Every time we reach a tile centre we stop,
       let onCentre() pick a new direction, then carry on with whatever distance is left.
       Stops dead at walls; wraps through the tunnel. */
    let left = speed * S * dt, moved = false, guard = 0;
    while (left > 0 && guard++ < 8){
      const [tx_, ty_] = tileOf(e);
      const cx = tx_*S + S/2, cy = ty_*S + S/2;
      const toC = (e.dx ? (cx - e.x) * e.dx : (cy - e.y) * e.dy);   // signed distance to this tile's centre along travel
      if (toC > 0.001){ const m = Math.min(left, toC); e.x += e.dx*m; e.y += e.dy*m; left -= m; moved = true; if (m === toC){ e.x = cx; e.y = cy; if (onCentre) onCentre(e, tx_, ty_); } continue; }
      if (toC > -0.001){ e.x = cx; e.y = cy; if (!e._decided){ if (onCentre) onCentre(e, tx_, ty_); } }
      e._decided = false;
      /* at centre: can we continue into the next tile? */
      if (!open(tx_ + e.dx, ty_ + e.dy)){ e.x = cx; e.y = cy; return moved; }
      const m = Math.min(left, S);
      e.x += e.dx*m; e.y += e.dy*m; left -= m; moved = true;
      if (e.x < -S/2) e.x += W*S; else if (e.x > W*S + S/2) e.x -= W*S;
    }
    return moved;
  }
  function snapIfCentred(e){ const [tx_,ty_]=tileOf(e); e.x = tx_*S+S/2; e.y = ty_*S+S/2; }

  function stepPlayer(dt){
    const [px, py] = tileOf(player);
    const spd = LV().p * (player.eating > 0 ? .87 : 1);           // nibbling slows you, like the original
    player.eating = Math.max(0, player.eating - dt);
    /* turn whenever the wanted direction is open from the current tile (with pre-turn tolerance) */
    if ((player.nx !== player.dx || player.ny !== player.dy)){
      const cx = px*S+S/2, cy = py*S+S/2;
      const near = Math.abs(player.x-cx) < S*.45 && Math.abs(player.y-cy) < S*.45;
      if (near && open(px+player.nx, py+player.ny)){
        if (player.nx === -player.dx && player.ny === -player.dy){ player.dx = player.nx; player.dy = player.ny; }
        else { player.x = cx; player.y = cy; player.dx = player.nx; player.dy = player.ny; }
      }
    }
    const moved = moveAlong(player, spd, dt, (e, cx_, cy_) => {
      if ((e.nx !== e.dx || e.ny !== e.dy) && open(cx_+e.nx, cy_+e.ny)){ e.dx = e.nx; e.dy = e.ny; }
      e._decided = true;
    });
    player.anim += moved ? dt*14 : 0;
    const [qx, qy] = tileOf(player);
    const t = at(qx, qy);
    if (t === 0 || t === 3){
      map[qy][qx] = 2; dots--; dotsEaten++; sips++; player.eating = .12;
      if (t === 0){ score += 10; sfx.munch(); }
      else { score += 50; sfx.power(); fright = LV().fs; ghostStreak = 0;
             ghosts.forEach(g => { if (g.state==='out'){ g.dx=-g.dx; g.dy=-g.dy; } });
             $('mzDrink').innerHTML = '<i style="background:'+SK.pellet+'"></i>'+SK.pelletName+' <small>+50 · the chains are scared</small>'; }
      if (score >= nextLifeAt){ lives++; nextLifeAt += 10000; pops.push({x:qx,y:qy,t:0,txt:'+1 LIFE'}); sfx.win(); }
      if ((dotsEaten === 70 || dotsEaten === 170) && !bonus) spawnBonus();
      hud();
    }
    if (bonus && Math.hypot(player.x-bonus.px, player.y-bonus.py) < S*.6){
      const pts = 300 * level;
      score += pts; drank.push(bonus.d[0]); tally[bonus.d[1]] = (tally[bonus.d[1]]||0)+1; sfx.bonus(); hud();
      pops.push({x:bonus.x,y:bonus.y,t:0,txt:'+'+pts+' '+bonus.d[0].toUpperCase()});
      $('mzDrink').innerHTML = '<i style="background:'+(CATC[bonus.d[1]]||'#fff')+'"></i>'+bonus.d[0]+' <small>+'+pts+' · '+bonus.d[1]+'</small>';
      bonus = null;
    }
    if (dots <= 0) { phase = 'clear'; phaseT = 1.6; sfx.win(); }
  }
  function spawnBonus(){
    const spots = [[9,11],[9,7],[9,3],[9,15]].filter(([x,y]) => open(x,y));
    const [bx,by] = spots[0] || [9,11];
    const d = pool[(bonusShown++ + level*2) % pool.length];
    bonus = { x:bx, y:by, px:bx*S+S/2, py:by*S+S/2, d, ttl: 9.5 };
    $('mzDrink').innerHTML = '<i style="background:'+(CATC[d[1]]||'#fff')+'"></i>'+d[0]+' <small>is up — grab it for '+(300*level)+'</small>';
  }

  function ghostTarget(g){
    const [px, py] = tileOf(player), [bx, by] = tileOf(ghosts[0]);
    if (g.state === 'eyes') return [DOOR.x, DOOR.y];
    if (mode === 'scatter') return CORNERS[g.n];
    switch (g.n){
      case 0: return [px, py];                                        // Big Chain: straight at you
      case 1: return [px + player.dx*4, py + player.dy*4];            // Copycat: four tiles ahead of you
      case 2: { const ax = px + player.dx*2, ay = py + player.dy*2; return [ax + (ax - bx), ay + (ay - by)]; } // Franchise: doubles Big Chain's line on you
      case 3: return Math.hypot(px - g.x/S, py - g.y/S) > 8 ? [px, py] : CORNERS[3];  // Knockoff: loses its nerve inside 8 tiles
    }
  }
  function stepGhost(g, dt){
    const lv = LV();
    if (g.state === 'pen'){
      /* bob in the pen until released by the dot counter (or a timer if you dawdle) */
      g.bob = (g.bob||0) + dt*3;
      g.y = PEN.y*S + S/2 + Math.sin(g.bob)*3;
      if (dotsEaten >= g.free || (performance.now() - startT) > 4000 * (g.n+1)){ g.state = 'leaving'; }
      return;
    }
    if (g.state === 'leaving'){
      /* slide to the pen centre, then straight up through the door */
      const cx = PEN.x*S + S/2, dy_ = DOOR.y*S + S/2;
      if (Math.abs(g.x - cx) > .5) g.x += Math.sign(cx - g.x) * Math.min(Math.abs(cx-g.x), lv.g*.6*S*dt);
      else { g.x = cx; g.y -= lv.g*.6*S*dt; if (g.y <= dy_){ g.y = dy_; g.state = 'out'; g.dx = Math.random()<.5?-1:1; g.dy = 0; } }
      return;
    }
    if (g.state === 'home'){
      g.y += lv.g*.6*S*dt;
      if (g.y >= PEN.y*S+S/2){ g.y = PEN.y*S+S/2; g.state = 'pen'; g.free = dotsEaten + 7; }
      return;
    }
    const frightened = fright > 0 && g.state === 'out';
    const speed = g.state === 'eyes' ? lv.g*2 : frightened ? lv.f : (tileOf(g)[1] === TUNNEL_Y && (g.x < 2*S || g.x > (W-2)*S)) ? lv.g*.55 : lv.g;
    /* choose a direction at each tile centre: never reverse, pick the option nearest the target */
    moveAlong(g, speed, dt, (e, gx, gy) => {
      if (e.state === 'eyes' && gx === DOOR.x && gy === DOOR.y){ e.state = 'home'; e.dx = 0; e.dy = 1; e._decided = true; return; }
      const opts = [[0,-1],[-1,0],[0,1],[1,0]].filter(([dx,dy]) => open(gx+dx, gy+dy) && !(dx===-e.dx && dy===-e.dy) && !(e.state!=='eyes' && gx+dx===DOOR.x && gy+dy===DOOR.y+1));
      if (opts.length){
        let pick;
        if (frightened) pick = opts[(Math.random()*opts.length)|0];
        else { const [tx_, ty_] = ghostTarget(e); pick = opts.reduce((b,o) => (Math.hypot(gx+o[0]-tx_, gy+o[1]-ty_) < Math.hypot(gx+b[0]-tx_, gy+b[1]-ty_) ? o : b), opts[0]); }
        e.dx = pick[0]; e.dy = pick[1];
      } else { e.dx = -e.dx; e.dy = -e.dy; }
      e._decided = true;
    });
  }

  function collide(){
    ghosts.forEach(g => {
      if (g.state !== 'out') return;
      if (Math.hypot(g.x - player.x, g.y - player.y) < S*.7){
        if (fright > 0){
          ghostStreak++; const pts = 200 * Math.pow(2, ghostStreak-1);
          score += pts; sfx.ghost(); hud(); flash = 6;
          pops.push({x:tileOf(g)[0], y:tileOf(g)[1], t:0, txt:'+'+pts+' '+GNAME[g.n].toUpperCase()+' BOUGHT OUT'});
          $('mzDrink').innerHTML = '<i style="background:#7CFF4F"></i>'+GNAME[g.n]+' bought out <small>+'+pts+'</small>';
          g.state = 'eyes'; snapIfCentred(g); g._decided = false;
          phase = 'pause'; phaseT = .45;
        } else { phase = 'dying'; dyingT = 0; sfx.die(); }
      }
    });
  }

  function tick(dt){
    if (phase === 'ready'){ phaseT -= dt; if (phaseT <= 0){ phase = 'play'; msg(''); } else msg('GET THIRSTY!'); return; }
    if (phase === 'pause'){ phaseT -= dt; if (phaseT <= 0) phase = 'play'; return; }
    if (phase === 'dying'){
      dyingT += dt;
      if (dyingT > 1.3){
        lives--; hud();
        if (lives <= 0){ playing = false; msg('GAME OVER — ' + score); finish(); }
        else { positions(); }
      }
      return;
    }
    if (phase === 'clear'){
      phaseT -= dt; flash = (phaseT*6|0)%2 ? 3 : 0;
      if (phaseT <= 0){ level++; score += 500; newLevel(); bakeWalls(); positions(); msg('LEVEL '+level+' — NEW MAZE'); }
      return;
    }
    /* scatter / chase clock (paused while frightened, as in the original) */
    if (fright > 0){ fright -= dt; if (fright <= 0){ fright = 0; ghostStreak = 0; } }
    else {
      modeT -= dt;
      if (modeT <= 0){ modeIdx = Math.min(modeIdx+1, LV().sched.length-1); modeT = LV().sched[modeIdx];
        mode = modeIdx % 2 ? 'chase' : 'scatter';
        ghosts.forEach(g => { if (g.state==='out'){ g.dx=-g.dx; g.dy=-g.dy; g._decided=false; } }); }
    }
    if (bonus){ bonus.ttl -= dt; if (bonus.ttl <= 0){ bonus = null; $('mzDrink').innerHTML='&nbsp;'; } }
    stepPlayer(dt);
    ghosts.forEach(g => stepGhost(g, dt));
    collide();
  }

  /* ── drawing ─────────────────────────────────────── */
  function bakeWalls(){
    wallLayer = document.createElement('canvas');
    wallLayer.width = canvas.width; wallLayer.height = canvas.height;
    const w = wallLayer.getContext('2d');
    w.strokeStyle = wallCol(); w.lineWidth = 2; w.shadowColor = wallCol(); w.shadowBlur = 6; w.lineCap = 'round';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (MAPSRC[y][x] === 1){
        const nb=[[0,-1],[1,0],[0,1],[-1,0]];
        nb.forEach(([dx,dy],i)=>{
          const v = (y+dy === TUNNEL_Y && (x+dx < 0 || x+dx >= W)) ? 2 : (MAPSRC[y+dy] && MAPSRC[y+dy][x+dx]);
          if (v===undefined || v===1) return;
          w.beginPath(); const X=x*S,Y=y*S;
          if(i===0){w.moveTo(X+2,Y+3);w.lineTo(X+S-2,Y+3);}
          if(i===1){w.moveTo(X+S-3,Y+2);w.lineTo(X+S-3,Y+S-2);}
          if(i===2){w.moveTo(X+2,Y+S-3);w.lineTo(X+S-2,Y+S-3);}
          if(i===3){w.moveTo(X+3,Y+2);w.lineTo(X+3,Y+S-2);}
          w.stroke();
        });
      }
    /* pen door */
    w.strokeStyle = '#FFB8FF'; w.shadowColor = '#FFB8FF'; w.lineWidth = 3;
    w.beginPath(); w.moveTo(DOOR.x*S+3, (DOOR.y+1)*S); w.lineTo(DOOR.x*S+S-3, (DOOR.y+1)*S); w.stroke();
  }
  function swirl(cx,cy,r,col){
    ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(cx,cy+r*.5,r,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy-r*.1,r*.75,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy-r*.6,r*.5,0,7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx-r*.25,cy-r*.9); ctx.lineTo(cx+r*.15,cy-r*1.5); ctx.lineTo(cx+r*.3,cy-r*.8); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0;
  }
  function chainCup(g){
    const gx = g.x, gy = g.y;
    if (g.state === 'eyes' || g.state === 'home'){
      ctx.fillStyle = '#F6F1FF';
      ctx.beginPath(); ctx.arc(gx-3,gy-1,2.4,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(gx+3,gy-1,2.4,0,7); ctx.fill();
      ctx.fillStyle = '#2A2AFF';
      ctx.beginPath(); ctx.arc(gx-3+g.dx*1.2,gy-1+g.dy*1.2,1.2,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(gx+3+g.dx*1.2,gy-1+g.dy*1.2,1.2,0,7); ctx.fill();
      return;
    }
    const scared = fright > 0 && g.state === 'out';
    const flashing = scared && fright < 2 && ((fright*5)|0) % 2;
    ctx.fillStyle = scared ? (flashing ? '#F6F1FF' : '#2B2BB8') : g.col;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(gx-6.5,gy-5); ctx.lineTo(gx+6.5,gy-5); ctx.lineTo(gx+5,gy+8); ctx.lineTo(gx-5,gy+8); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = scared ? (flashing ? '#FF3CAC' : '#2AF5E4') : 'rgba(255,255,255,.85)'; ctx.fillRect(gx-7.5,gy-8,15,3);
    ctx.fillStyle = '#08011C';
    if (scared){ ctx.fillRect(gx-3.5,gy-2,2,2); ctx.fillRect(gx+1.5,gy-2,2,2);
      ctx.strokeStyle='#08011C'; ctx.lineWidth=1; ctx.beginPath(); for(let i=-3;i<=3;i++) ctx.lineTo(gx+i, gy+4+(i%2?1.5:0)); ctx.stroke(); }
    else {
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(gx-2.6,gy-1,2,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(gx+2.6,gy-1,2,0,7); ctx.fill();
      ctx.fillStyle='#08011C'; ctx.beginPath(); ctx.arc(gx-2.6+g.dx,gy-1+g.dy,1,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(gx+2.6+g.dx,gy-1+g.dy,1,0,7); ctx.fill();
      ctx.strokeStyle='#08011C'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(gx-2.5,gy+4); ctx.lineTo(gx+2.5,gy+4); ctx.stroke();
    }
  }
  function draw(){
    ctx.fillStyle = SK.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (wallLayer) ctx.drawImage(wallLayer, 0, 0);
    const blinkP = ((performance.now()/250)|0) % 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      const v = map[y][x];
      if (v === 0){ ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.arc(x*S+S/2, y*S+S/2, 2, 0, 7); ctx.fill(); }
      else if (v === 3 && blinkP){ swirl(x*S+S/2, y*S+S/2, 4.2, SK.pellet); }
    }
    if (bonus){
      const bx = bonus.px, by = bonus.py, col = CATC[bonus.d[1]]||'#FFD166';
      const pulse = 1 + Math.sin(performance.now()/180)*.08, urgent = bonus.ttl < 2.5 && ((bonus.ttl*5)|0) % 2;
      ctx.save(); ctx.translate(bx,by); ctx.scale(pulse,pulse);
      ctx.shadowColor = col; ctx.shadowBlur = urgent ? 4 : 16;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-6,-5); ctx.lineTo(6,-5); ctx.lineTo(4.5,8); ctx.lineTo(-4.5,8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFF4FA'; ctx.fillRect(-7,-8,14,3); ctx.fillRect(1,-13,2,6);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-2,0,1.4,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(2,3,1.1,0,7); ctx.fill();
      ctx.restore();
      ctx.font = 'bold 10px "DM Mono", monospace'; ctx.textAlign='center'; ctx.fillStyle = urgent ? '#FF3CAC' : '#FFF4FA'; ctx.shadowColor='#000'; ctx.shadowBlur=4;
      ctx.fillText(bonus.d[0], Math.min(canvas.width-46, Math.max(46, bx)), by + 20); ctx.shadowBlur=0;
    }
    /* player: chomping cup (or dying spin) */
    const px = player.x, py = player.y;
    if (phase === 'dying'){
      const k = Math.min(1, dyingT/1.1);
      ctx.fillStyle = '#F6F1FF'; ctx.shadowColor='#FF3CAC'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.moveTo(px,py); ctx.arc(px,py,8*(1-k*.9), -Math.PI/2 + k*Math.PI, -Math.PI/2 - k*Math.PI + Math.PI*2); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
    } else if (phase !== 'clear' || flash){
      const mouth = (Math.sin(player.anim) + 1) * .28;
      const ang = Math.atan2(player.dy, player.dx || .0001);
      ctx.fillStyle = '#F6F1FF'; ctx.shadowColor='#FF3CAC'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, 8, ang + mouth, ang - mouth + Math.PI*2); ctx.closePath(); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle = '#FF2D95'; ctx.beginPath(); ctx.arc(px, py - 4.5, 1.8, 0, 7); ctx.fill();
    }
    if (phase !== 'dying' || dyingT < .3) ghosts.forEach(g => { ctx.globalAlpha = g.state==='pen' ? .8 : 1; chainCup(g); ctx.globalAlpha = 1; });
    if (flash > 0){ ctx.fillStyle = 'rgba(124,255,79,'+(flash/6*.35)+')'; ctx.fillRect(0,0,canvas.width,canvas.height); flash--; }
    if (phase === 'ready'){ ctx.font = 'bold 16px "Bungee", sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#FFD166'; ctx.shadowColor='#FFD166'; ctx.shadowBlur=12; ctx.fillText('GET THIRSTY!', W*S/2, 11*S+S/2+6); ctx.shadowBlur=0; }
    ctx.textAlign='center';
    pops = pops.filter(p => (p.t += 1) < 36);
    pops.forEach(p => { ctx.font = (p.txt.startsWith('+') ? 'bold 12px' : 'bold 9px') + ' "DM Mono", monospace'; ctx.globalAlpha = 1 - p.t/36; ctx.fillStyle = '#FFF4FA'; ctx.shadowColor='#000'; ctx.shadowBlur=4;
      ctx.fillText(p.txt, Math.min(canvas.width-50, Math.max(50, p.x*S+S/2)), p.y*S - p.t*.5); });
    ctx.globalAlpha = 1; ctx.shadowBlur=0;
  }

  /* ── scores, prizes, leaderboard ─────────────────── */
  const API='https://tb-where.nicholasroper.workers.dev';
  const BEST='tb-best', DEV='tb-device', PLAY_CAP=3;
  /* The weekly free-drink draw is OFF until official rules exist (compliance gate 2026-11-15): no draw copy, no ticket.
     Turn it on only after /maze-rules has the sponsor, prize and claim-window details filled in AND the worker has
     DRAW_ENABLED="true" (worker-tb-where/README). The play token below is independent of the draw. */
  const DRAW_ON = false;
  /* A server-signed play token is fetched when a game starts. The server will not record a score, mint an upsize code
     or enter a draw without a valid, unused, old-enough one, so the score box cannot be scripted for free codes. */
  let playToken = null, playTokenAt = 0, playMinMs = 45000;
  async function fetchPlayToken(){
    playToken = null;
    try{ const r = await fetch(API + '/scores/token', { cache:'no-store' }); if(r.ok){ const d = await r.json(); playToken = d.token || null; playTokenAt = Date.now(); playMinMs = Number(d.minMs) || 45000; } }
    catch(e){ playToken = null; }
  }
  function deviceId(){ let d=null; try{ d=localStorage.getItem(DEV); }catch(e){}
    if(!d){ d=Math.random().toString(36).slice(2)+Date.now().toString(36); try{ localStorage.setItem(DEV,d); }catch(e){} } return d; }
  const CAPPED = !(typeof PRELAUNCH !== 'undefined' && PRELAUNCH);   // no daily cap until we are open
  if (location.hash === '#reset-plays'){ try{ localStorage.removeItem('tb-plays-'+DAY); }catch(e){} history.replaceState(null,'','#play'); }
  function playsToday(){ const k='tb-plays-'+DAY; let n=0; try{ n=CAPPED ? Number(localStorage.getItem(k)||0) : 0; }catch(e){}
    return {n, bump(){ try{ localStorage.setItem(k, String(n+1)); }catch(e){} }}; }
  function best(){ let v=0; try{ v=Number(localStorage.getItem(BEST)||0); }catch(e){} return v; }
  function setBest(v){ try{ localStorage.setItem(BEST,String(v)); }catch(e){} }

  function recap(){
    const n = drank.length;
    const fav = Object.entries(tally).sort((a,b)=>b[1]-a[1])[0];
    const secs = Math.round((performance.now()-startT)/1000);
    const pickDrink = drank.length ? drank[(Math.random()*drank.length)|0] : window.__pool[0][0];
    let h = `<p class="board__t">Your tab</p><div class="recap">`;
    h += `<div><b>${n}</b><span>drinks caught</span></div>`;
    h += `<div><b>${sips}</b><span>sips</span></div>`;
    h += `<div><b>${secs}s</b><span>at the window</span></div>`;
    if (fav) h += `<div><b style="color:${CATC[fav[0]]||'#fff'}">${fav[1]}</b><span>${fav[0]}</span></div>`;
    h += `</div>`;
    if (drank.length) h += `<p class="recap__try">You caught ${drank.slice(0,4).map(esc).join(', ')}${drank.length>4?' and more':''}.</p>`;
    h += `<p class="recap__try">Thirsty for real? Try a <a href="/menu">${esc(pickDrink)}</a> at the window.</p>`;
    return h;
  }

  /* three-letter initials, arcade style */
  function initials(){
    return new Promise(res=>{
      const b=$('mzBoard'); b.style.display='block';
      const saved = (()=>{ try{ return localStorage.getItem('tb-who')||'TB'; }catch(e){ return 'TB'; } })().toUpperCase().replace(/[^A-Z ]/g,'').padEnd(3,'A').slice(0,3).split('');
      b.innerHTML = `<p class="board__t">Enter your initials</p><div class="initials">${saved.map((c,i)=>`<div class="ini" data-i="${i}"><button type="button" data-up>&#9650;</button><b>${c}</b><button type="button" data-dn>&#9660;</button></div>`).join('')}</div><button class="btn btn--solid" type="button" id="mzOk">LOCK IT IN</button>`;
      const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
      b.querySelectorAll('.ini').forEach(el=>{
        const i=+el.dataset.i, out=el.querySelector('b');
        el.querySelector('[data-up]').onclick=()=>{ saved[i]=A[(A.indexOf(saved[i])+1)%A.length]; out.textContent=saved[i]; beep(660,40); };
        el.querySelector('[data-dn]').onclick=()=>{ saved[i]=A[(A.indexOf(saved[i])+A.length-1)%A.length]; out.textContent=saved[i]; beep(520,40); };
      });
      b.querySelector('#mzOk').onclick=()=>{ const who=saved.join('').trim()||'TB'; try{localStorage.setItem('tb-who',who);}catch(e){} res(who); };
    });
  }

  async function finish(){
    const isBest = score > best(); if (isBest) setBest(score);
    msg(isBest ? 'NEW PERSONAL BEST — ' + score : 'GAME OVER — ' + score);
    $('mzPad').style.display='none';
    let top = [], code = null, prize = null, draw = null;
    if (score >= 500){
      const who = await initials();
      /* the server wants the token to be at least playMinMs old: wait out the rest instead of losing the score */
      const wait = playToken ? playTokenAt + playMinMs + 500 - Date.now() : 0;
      if (wait > 0){ msg('Saving your score…'); await new Promise(r => setTimeout(r, Math.min(wait, playMinMs + 1000))); }
      try{
        const r = await fetch(API + '/scores', { method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ score, who, token: playToken }) });
        const d = await r.json(); top = d.top || []; code = d.code; prize = d.prize; draw = d.draw || null;
      }catch(e){}
      playToken = null;
    }
    board(top, code, prize, draw);
  }
  function board(top, code, prize, draw){
    const b = $('mzBoard'); b.style.display='block';
    let html = recap();
    if (code){
      html += `<div class="prize"><b>FREE UPSIZE</b><span>${code}</span><small>Type it into the kiosk or show it at the window · today only · one use</small></div>`;
    } else if (prize === 'already-claimed'){
      html += `<div class="prize prize--done"><b>ALREADY WON TODAY</b><small>One upsize a day — come back tomorrow</small></div>`;
    }
    /* draw copy is shown only when the draw is on AND the server issued a ticket (it is off by default, see DRAW_ON) */
    if (DRAW_ON && draw && draw.ticket){
      html += `<div class="prize prize--ticket"><b>YOUR DRAW TICKET</b><span>${esc(draw.ticket)}</span><small>${draw.already ? 'This is your ticket for the week. ' : ''}Keep this code. If it is posted as the winner you claim your drink at the window. No purchase necessary. <a href="/maze-rules">Rules</a></small></div>`;
    }
    if (top.length){
      html += '<p class="board__t">Today’s top scores</p><ol class="board__l">' +
        top.map(s=>`<li><span>${esc(s.who)}</span><b>${s.score}</b></li>`).join('') + '</ol>';
    }
    if (DRAW_ON) html += `<p class="board__fine">No purchase necessary. Free game; one draw entry per person per week. Rules: <a href="/maze-rules">thirstybeaches.com/maze-rules</a>.</p>`;
    html += `<div class="board__acts"><button class="btn btn--solid" type="button" id="mzAgain">Play again</button><button class="btn btn--ghost" type="button" id="mzShare">Share score</button></div>`;
    b.innerHTML = html;
    $('mzAgain').onclick = () => { b.style.display='none'; startGame(); };
    $('mzShare').onclick = share;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* share card: a PNG with the score, generated on the fly */
  async function share(){
    const c=document.createElement('canvas'); c.width=1080; c.height=1080; const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,0,1080); g.addColorStop(0,'#12032E'); g.addColorStop(1,'#5a1268'); x.fillStyle=g; x.fillRect(0,0,1080,1080);
    x.strokeStyle='rgba(42,245,228,.25)'; x.lineWidth=2; for(let i=0;i<1080;i+=60){ x.beginPath(); x.moveTo(i,640); x.lineTo(540+(i-540)*3,1080); x.stroke(); }
    x.fillStyle='#FFD166'; x.textAlign='center'; x.font='bold 64px "Bungee", sans-serif'; x.fillText(SK.title,540,200);
    x.fillStyle='#FFF4FA'; x.font='bold 220px "Bungee", sans-serif'; x.shadowColor='#FF3CAC'; x.shadowBlur=40; x.fillText(String(score),540,520); x.shadowBlur=0;
    x.fillStyle='#2AF5E4'; x.font='40px "DM Mono", monospace'; x.fillText(drank.length+' DRINKS CAUGHT · '+DAY,540,620);
    x.fillStyle='#FF3CAC'; x.font='bold 56px "Bungee", sans-serif'; x.fillText('THIRSTY BEACHES',540,940);
    x.fillStyle='rgba(255,244,250,.7)'; x.font='32px "DM Mono", monospace'; x.fillText('thirstybeaches.com/play',540,1000);
    const text = 'I scored '+score+' in '+SK.title+' at Thirsty Beaches. Beat me: https://thirstybeaches.com/play';
    try{
      const blob = await new Promise(r=>c.toBlob(r,'image/png'));
      const file = new File([blob],'thirsty-maze.png',{type:'image/png'});
      if (navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], text}); return; }
      if (navigator.share){ await navigator.share({text}); return; }
    }catch(e){ if (e && e.name==='AbortError') return; }
    try{ await navigator.clipboard.writeText(text); msg('Copied — paste it anywhere'); }catch(e){ prompt('Copy this:', text); }
  }

  /* ── game loop ───────────────────────────────────── */
  let last = 0;
  function loop(t){
    if (!playing) return;
    loopId = requestAnimationFrame(loop);
    let dt = Math.min(t - last, 100) / 1000; last = t;      // ignore huge gaps (tab was hidden)
    /* fixed sub-steps keep collisions honest on slow frames */
    while (dt > 0){ const h = Math.min(dt, 1/120); tick(h); dt -= h; if (!playing) return; }
    draw();
  }

  function startGame(){
    fetchPlayToken();
    reset(true); bakeWalls(); msg('');
    $('mzAttract').classList.remove('on'); $('mzPad').style.display='';
    playing = true; last = performance.now();
    loopId = requestAnimationFrame(loop);
  }
  let opener = null;
  /* modal for real: the rest of the page goes inert (no tabbing or tapping behind it) */
  let locked = [];
  function lockPage(on){
    if (on){
      if (locked.length) return;            // already open
      locked = [...document.body.children].filter(el => el !== wrap && !el.inert && el.tagName !== 'SCRIPT');
      locked.forEach(el => { el.inert = true; el.setAttribute('aria-hidden','true'); });
      wrap.addEventListener('keydown', trap);
    } else {
      locked.forEach(el => { el.inert = false; el.removeAttribute('aria-hidden'); });
      locked = [];
      wrap.removeEventListener('keydown', trap);
    }
  }
  /* fallback focus trap for browsers without inert */
  function trap(e){
    if (e.key !== 'Tab') return;
    const f = [...wrap.querySelectorAll('button,[href],input,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null && !el.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length-1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
  function openCabinet(){
    const b=$('mzBoard'); b.style.display='none'; b.innerHTML='';
    reset(true); bakeWalls(); draw(); msg(''); $('mzDrink').innerHTML='&nbsp;';
    pauseRunner();
    opener = document.activeElement;
    document.body.dataset.arcade = '1';
    wrap.classList.add('on');
    lockPage(true);
    $('mzAttract').classList.add('on');
    addEventListener('keydown', tryTurn);
    addEventListener('keydown', startOnKey);
    $('mzStart').focus();
  }
  const SKIP_KEYS = ['Tab','Shift','Alt','Meta','Control','Enter','CapsLock'];
  function startOnKey(e){ if (!playing && $('mzAttract').classList.contains('on') && !e.metaKey && !e.ctrlKey && e.key!=='Escape' && !SKIP_KEYS.includes(e.key)){ e.preventDefault(); coinUp(); } }
  function coinUp(){
    const p = playsToday();
    if (p.n >= PLAY_CAP){
      $('mzAttract').classList.remove('on'); $('mzBoard').style.display='block';
      $('mzBoard').innerHTML = `<div class="prize prize--done"><b>THAT'S YOUR THREE</b><small>Three goes a day &mdash; the maze resets tomorrow</small></div>`;
      return;
    }
    p.bump(); sfx.coin(); setTimeout(startGame, 350);
  }
  $('mzStart').onclick = coinUp;
  function close(){
    playing = false; cancelAnimationFrame(loopId);
    removeEventListener('keydown', tryTurn); removeEventListener('keydown', startOnKey);
    wrap.classList.remove('on'); delete document.body.dataset.arcade; lockPage(false); resumeRunner();
    if (location.hash === '#play') history.replaceState(null,'',location.pathname);
    if (opener && typeof opener.focus === 'function') opener.focus();
    opener = null;
  }

  if (runner) runner.addEventListener('click', openCabinet);
  wrap.querySelector('.arcade__close').addEventListener('click', close);
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  document.querySelectorAll('[data-play]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openCabinet(); }));
  if (location.hash === '#play') setTimeout(openCabinet, 400);
  addEventListener('hashchange', () => { if (location.hash === '#play') openCabinet(); });
})();
