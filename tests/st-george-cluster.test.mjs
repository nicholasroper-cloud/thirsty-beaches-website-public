// node tests/st-george-cluster.test.mjs — the Washington County cluster (round one 2026-11-16, round two 2026-11-17): titles and metas,
// sitemap, CSP, schema rules, FAQ text = FAQPage JSON-LD, hub-and-spoke internal links, prelaunch claim rules, no near-duplicate
// (doorway) town pages, the Ivins & Santa Clara split redirect, home St. George FAQ prices vs the menu, IndexNow key.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read = p => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
const un = h => h.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&rsquo;/g, '’').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&eacute;/g, 'é').replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&ndash;/g, '–');
const strip = h => un(h.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const lds = h => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

const TOWNS = { 'dirty-soda-washington-city': 'Washington City', 'dirty-soda-santa-clara': 'Santa Clara', 'dirty-soda-ivins': 'Ivins', 'dirty-soda-hurricane-sand-hollow': 'Hurricane',
  'dirty-soda-laverkin-toquerville-leeds': 'LaVerkin', 'dirty-soda-desert-color': 'Desert Color', 'dirty-soda-bloomington-green-valley': 'Bloomington' };
const EVENTS = { 'st-george-wedding-soda-bar': 'Wedding', 'st-george-tournaments-team-parties': 'Tournament', 'st-george-church-school-events': 'Church',
  'st-george-company-party': 'Company', 'st-george-graduation-birthday-party': 'Graduation', 'st-george-hoa-neighborhood-party': 'HOA' };
const ROUND2 = ['dirty-soda-santa-clara', 'dirty-soda-ivins', 'dirty-soda-laverkin-toquerville-leeds', 'dirty-soda-desert-color', 'dirty-soda-bloomington-green-valley',
  'st-george-company-party', 'st-george-graduation-birthday-party', 'st-george-hoa-neighborhood-party'];
const NEW = [...Object.keys(TOWNS), ...Object.keys(EVENTS)];
const CLUSTER = ['dirty-soda-st-george', ...NEW];
const sitemap = read('sitemap.xml'), headers = read('_headers');

const titles = new Set(), metas = new Set();
for (const f of NEW) {
  const h = read(f + '.html');
  const rawTitle = /<title>([^<]*)<\/title>/.exec(h)[1], title = un(rawTitle), desc = un(/<meta name="description" content="([^"]*)"/.exec(h)[1]);
  // title <= 60 (raw and decoded), city first; meta <= 155; unique
  assert.ok(rawTitle.length <= 60 && title.length <= 60, `${f} title ${rawTitle.length}: ${title}`);
  assert.ok(title.startsWith(TOWNS[f] || 'St. George'), `${f} title starts with the place: ${title}`);
  assert.ok(desc.length >= 120 && desc.length <= 155, `${f} meta ${desc.length}`);
  assert.ok(!titles.has(title) && !metas.has(desc), f + ' duplicate title/meta'); titles.add(title); metas.add(desc);
  assert.equal(un(/og:title" content="([^"]*)"/.exec(h)[1]), title, f + ' og:title');
  assert.match(h, new RegExp(`<link rel="canonical" href="https://thirstybeaches\\.com/${f}">`));
  assert.equal((h.match(/<h1[ >]/g) || []).length, 1, f + ' one H1');
  // sitemap + CSP on both the clean and the .html path
  assert.match(sitemap, new RegExp(`<loc>https://thirstybeaches\\.com/${f}</loc>`), f + ' in sitemap');
  for (const p of ['/' + f, '/' + f + '.html']) assert.match(headers, new RegExp('^' + p.replace(/[.]/g, '\\.') + '\\n  Content-Security-Policy: default-src \'self\'', 'm'), 'CSP on ' + p);
  // 700+ words in <main>
  const main = h.slice(h.indexOf('<main'), h.indexOf('</main>')).replace(/<(script|style|form)[\s\S]*?<\/\1>/g, '');
  assert.ok(strip(main).split(' ').length >= 700, f + ' has 700+ words');
  // schema: business or Service + FAQPage + BreadcrumbList; St. George is crumb 2; no street address, no hours
  const ld = lds(h), types = ld.map(x => x['@type']);
  assert.ok(types.includes('BreadcrumbList') && types.includes('FAQPage') && (types.includes('FoodEstablishment') || types.includes('Service')), f + ' schema ' + types);
  const crumbs = ld.find(x => x['@type'] === 'BreadcrumbList').itemListElement;
  assert.equal(crumbs.length, 3); assert.equal(crumbs[1].item, 'https://thirstybeaches.com/dirty-soda-st-george'); assert.equal(crumbs[2].item, 'https://thirstybeaches.com/' + f);
  const biz = ld.find(x => x['@type'] === 'FoodEstablishment') || ld.find(x => x['@type'] === 'Service').provider;
  assert.equal(biz['@id'], 'https://thirstybeaches.com/#business');
  assert.ok(!('address' in biz) && !JSON.stringify(ld).includes('streetAddress') && !JSON.stringify(ld).includes('openingHours'), f + ': no address or hours before the move');
  const area = (ld.find(x => x['@type'] === 'FoodEstablishment') || ld.find(x => x['@type'] === 'Service')).areaServed.map(a => a.name);
  for (const n of ['St. George', 'Washington', 'Ivins', 'Santa Clara', 'Hurricane', 'Washington County']) assert.ok(area.includes(n), `${f} areaServed has ${n}`);
  assert.ok(!JSON.stringify(ld).includes('thirstybeaches_fl') && !JSON.stringify(ld).includes('thirstybeachesflorida'), f + ': no Florida handles in sameAs');
  // the visible breadcrumb matches the schema
  assert.match(h, /<p class="crumbs"><a href="\/">Thirsty Beaches<\/a> &middot; <a href="\/dirty-soda-st-george">St\. George<\/a> &middot; /);
  // claim rules: no dates, no "we'll be there", no "no competition"; Swig only as "Utah's best-known chain"
  const txt = strip(main);
  assert.ok(!/\bSwig\b/i.test(h), f + ' names Swig');
  assert.ok(!/(no|zero|without) (other )?(competitors?|competition)|only dirty soda|first dirty soda trailer/i.test(txt), f + ' competitor claim');
  assert.ok(!/(we'll|we will|we're going to) be (at|there)|see you at/i.test(txt), f + ' attendance claim');
  assert.ok(!/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b|\b20(26|27)\b/.test(txt), f + ' has a date');
  assert.ok(!/opening (on|in) (January|February|March|spring)/i.test(txt), f + ' opening date claim');
}

// FAQ text matches FAQPage JSON-LD on every page that has one (home, St. George cluster, all sitemap pages)
for (const u of [...sitemap.matchAll(/<loc>https:\/\/thirstybeaches\.com\/([^<]*)<\/loc>/g)].map(m => m[1])) {
  const h = read((u || 'index') + '.html'), faq = lds(h).find(x => x['@type'] === 'FAQPage');
  if (!faq) continue;
  const vis = [...h.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map(m => [strip(m[1]), strip(m[2])]);
  assert.deepEqual(faq.mainEntity.map(q => [q.name, q.acceptedAnswer.text]), vis, (u || 'home') + ': FAQPage JSON-LD = visible FAQ');
}

// home: the St. George FAQ answers the five searched questions, and its prices are the menu's prices
const home = read('index.html');
assert.match(home, /<h2 class="h2">St\. George dirty soda FAQ<\/h2>/);
for (const q of ['What is a dirty soda?', 'Where is the trailer?', 'Can I book Thirsty Beaches for an event in St. George?', 'Do you have drinks for kids?', 'How much is a dirty soda?'])
  assert.ok(home.includes(`<summary>${q}</summary>`), 'home FAQ: ' + q);
const menu = lds(read('menu.html')).find(x => x['@type'] === 'Menu');
const sec = n => menu.hasMenuSection.find(s => s.name === n).hasMenuItem.map(i => Number(i.offers.price));
const money = n => '$' + n.toFixed(2), rng = a => Math.min(...a) === Math.max(...a) ? money(a[0]) : `${money(Math.min(...a))} to ${money(Math.max(...a))}`;
const all = menu.hasMenuSection.flatMap(s => s.hasMenuItem.map(i => Number(i.offers.price)));
const priceA = strip(/<summary>How much is a dirty soda\?<\/summary><p>([\s\S]*?)<\/p>/.exec(home)[1]);
assert.ok(priceA.includes(`dirty sodas are ${rng(sec('Dirty Sodas'))}`), 'FAQ dirty soda price = menu (rerun after tools/sync-menu.py): ' + priceA);
assert.ok(priceA.includes(`kid sizes are ${rng(sec('Beach Babies'))}`), 'FAQ kid price = menu');
assert.ok(priceA.includes(`floats are ${rng(sec('Floats'))}`), 'FAQ float price = menu');
assert.ok(priceA.includes(`board runs ${rng(all)}`), 'FAQ board range = menu');
assert.ok(/Utah's best-known chain started here in St\. George/.test(strip(home)) && !/\bSwig\b/.test(home), 'home: Swig only as the best-known chain');
const homeBiz = lds(home)[0]['@graph'].find(x => x['@type'] === 'FoodEstablishment');
for (const n of ['St. George', 'Washington County', 'Washington', 'Ivins', 'Santa Clara', 'Hurricane']) assert.ok(homeBiz.areaServed.some(a => a.name === n), 'home areaServed ' + n);
assert.ok(!homeBiz.openingHoursSpecification && !(homeBiz.address || {}).streetAddress, 'home: no hours or street address');

// internal links, hub and spoke: the St. George page links every cluster page from its body (not just chips/footer), every
// cluster page links back to the hub from its body, and home, the Utah hub, the footer partial and every Utah page link the cluster
const links = (h, list) => list.every(f => h.includes(`href="/${f}"`));
const body = h => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
const about = h => (h.match(/<div class="about">[\s\S]*?<\/div>/) || [''])[0];
const hub = read('dirty-soda-st-george.html');
assert.ok(links(about(hub) + (hub.match(/<div class="cards[^"]*">[\s\S]*?<\/div>/) || [''])[0], NEW), 'St. George hub body links every cluster page');
for (const f of NEW) assert.ok(about(read(f + '.html')).includes('href="/dirty-soda-st-george"'), f + ' body links back to the St. George hub');
assert.ok(links(home, CLUSTER), 'home links the cluster');
assert.ok(links(read('utah-dirty-soda-catering.html'), CLUSTER), 'Utah hub links the cluster');
assert.ok(links(readFileSync(new URL('../tools/partials/footer.html', import.meta.url), 'utf8'), NEW), 'footer partial links the cluster');
const UTAH = ['index', 'menu', 'dirty-soda-lehi', 'dirty-soda-salt-lake-city', 'dirty-soda-utah-county', 'utah-dirty-soda-catering', 'dirty-soda-wedding-catering-utah', 'dirty-soda-school-church-events-utah', 'dirty-soda-company-party-utah', ...CLUSTER];
for (const f of UTAH) assert.ok(links(read(f + '.html'), CLUSTER.filter(x => x !== f)), f + ' links St. George and the cluster');
// every town or neighborhood page links at least one other place page from its own copy (the town web, not only the chips)
for (const f of Object.keys(TOWNS)) assert.ok(Object.keys(TOWNS).filter(x => x !== f && about(read(f + '.html')).includes(`href="/${x}"`)).length >= 1, f + ' links a sibling town in its copy');
// home city chips row carries the town pages right after St. George
assert.match(home, /<div class="chips" aria-label="Utah service area">\s*<a class="chip" href="\/dirty-soda-st-george">St\. George<\/a><a class="chip" href="\/dirty-soda-washington-city">Washington City<\/a><a class="chip" href="\/dirty-soda-santa-clara">Santa Clara<\/a><a class="chip" href="\/dirty-soda-ivins">Ivins<\/a><a class="chip" href="\/dirty-soda-hurricane-sand-hollow">Hurricane<\/a>/);
// no doorway pages: the local copy (about sections + FAQ answers) of any two place pages shares under 20% of its 5-word shingles
const local = f => strip(about(read(f + '.html')) + (read(f + '.html').match(/<div class="faq">[\s\S]*?<\/div>/) || [''])[0]).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const sh = f => { const w = local(f), s = new Set(); for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' ')); return s; };
const PLACES = ['dirty-soda-st-george', ...Object.keys(TOWNS), ...Object.keys(EVENTS)], S = Object.fromEntries(PLACES.map(f => [f, sh(f)]));
for (let i = 0; i < PLACES.length; i++) for (let j = i + 1; j < PLACES.length; j++) {
  const a = S[PLACES[i]], b = S[PLACES[j]], inter = [...a].filter(x => b.has(x)).length, jac = inter / (a.size + b.size - inter);
  assert.ok(jac < 0.2, `${PLACES[i]} vs ${PLACES[j]}: ${(jac * 100).toFixed(1)}% shared 5-word shingles (doorway risk)`);
}
// the round-two pages each have their own local copy: 450+ words in the about sections, and a unique H1
const h1s = new Set();
for (const f of ROUND2) { const h = read(f + '.html'); assert.ok(strip(about(h)).split(' ').length >= 450, f + ' local copy'); const t = /<h1[^>]*>([^<]*)<\/h1>/.exec(h)[1]; assert.ok(!h1s.has(t)); h1s.add(t); }
// the St. George event pages offer the HOA option in the quote form and use the 435 placeholder
for (const f of Object.keys(EVENTS)) { const h = read(f + '.html'); assert.ok(/<option( selected)?>HOA or neighborhood party<\/option>/.test(h) && h.includes('placeholder="(435) 555-5555"'), f + ' St. George form'); }
// the old combined Ivins & Santa Clara URL: gone from the site, 301 to Santa Clara, linked from nowhere
const files0 = readdirSync(new URL('../site/', import.meta.url));
assert.ok(!files0.includes('dirty-soda-ivins-santa-clara.html') && !sitemap.includes('dirty-soda-ivins-santa-clara'), 'old combined page removed');
assert.match(read('_redirects'), /^\/dirty-soda-ivins-santa-clara\s+\/dirty-soda-santa-clara\s+301$/m);
assert.match(read('_redirects'), /^\/dirty-soda-ivins-santa-clara\.html\s+\/dirty-soda-santa-clara\s+301$/m);
for (const f of files0.filter(f => /\.(html|md|txt)$/.test(f))) assert.ok(!read(f).includes('/dirty-soda-ivins-santa-clara'), f + ' still links the old Ivins & Santa Clara URL');
// sitemap lastmod never in the future
const today = new Date().toISOString().slice(0, 10);
for (const m of sitemap.matchAll(/<lastmod>([0-9-]+)<\/lastmod>/g)) assert.ok(m[1] <= today, 'future lastmod ' + m[1]);
// areaServed: the north-county page adds LaVerkin, Toquerville and Leeds; the hub lists Leeds
assert.ok(['LaVerkin', 'Toquerville', 'Leeds'].every(n => lds(read('dirty-soda-laverkin-toquerville-leeds.html'))[0].areaServed.some(a => a.name === n)), 'north county areaServed');
assert.ok(lds(hub)[0].areaServed.some(a => a.name === 'Leeds'), 'hub areaServed Leeds');
// no link points at a page that does not exist
const files = new Set(readdirSync(new URL('../site/', import.meta.url)).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, '')));
for (const f of CLUSTER) for (const m of read(f + '.html').matchAll(/href="\/([a-z0-9-]+)(?:[?#][^"]*)?"/g)) assert.ok(files.has(m[1]) || ['card'].includes(m[1]), `${f} links missing /${m[1]}`);

// IndexNow: key file content = key in the tool; kept off the worker
const tool = readFileSync(new URL('../tools/indexnow.mjs', import.meta.url), 'utf8');
const key = /const KEY = '([0-9a-f]{32})'/.exec(tool)[1];
assert.equal(read(key + '.txt').trim(), key);
assert.ok(JSON.parse(read('_routes.json')).exclude.includes('/' + key + '.txt'));
assert.match(tool, /const HOST = 'thirstybeaches\.com'/);
// Cloudflare Pages allows at most 100 _headers rules
assert.ok(headers.split('\n').filter(l => /^(\/|https:)/.test(l)).length <= 100, '_headers rule count');
console.log('st-george-cluster.test.mjs ok');
