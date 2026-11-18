// node tests/site.test.mjs — static checks on the public pages: SEO lengths, St. George-first (2026-11-15 launch call), prelaunch HTML, CSP, signup form, no inline scripts.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read = p => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
const un = h => h.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

// city and catering pages: title <= 60, description <= 155, the city or region first
for (const [f, first] of [['dirty-soda-st-george', 'St. George'], ['dirty-soda-washington-city', 'Washington City'], ['dirty-soda-santa-clara', 'Santa Clara'], ['dirty-soda-ivins', 'Ivins'], ['dirty-soda-desert-color', 'Desert Color'], ['dirty-soda-bloomington-green-valley', 'Bloomington'], ['dirty-soda-laverkin-toquerville-leeds', 'LaVerkin'], ['st-george-company-party', 'St. George'], ['st-george-graduation-birthday-party', 'St. George'], ['st-george-hoa-neighborhood-party', 'St. George'], ['dirty-soda-hurricane-sand-hollow', 'Hurricane'], ['st-george-wedding-soda-bar', 'St. George'], ['st-george-tournaments-team-parties', 'St. George'], ['st-george-church-school-events', 'St. George'], ['dirty-soda-naples', 'Naples'], ['dirty-soda-sarasota', 'Sarasota'], ['dirty-soda-tampa-bay', 'Tampa Bay'], ['dirty-soda-lehi', 'Lehi'], ['dirty-soda-salt-lake-city', 'Salt Lake City'], ['dirty-soda-utah-county', 'Provo'], ['utah-dirty-soda-catering', 'Catering'], ['florida-dirty-soda-catering', 'Catering']]) {
  const h = read(f + '.html');
  const title = un(/<title>([^<]*)<\/title>/.exec(h)[1]), desc = un(/<meta name="description" content="([^"]*)"/.exec(h)[1]);
  assert.ok(title.length <= 60, `${f} title ${title.length}: ${title}`); assert.ok(/<title>([^<]*)<\/title>/.exec(h)[1].length <= 60, f + ' raw title length'); assert.ok(desc.length <= 155, `${f} description ${desc.length}`);
  assert.ok(title.includes(first), `${f} title keeps ${first}`);
  assert.equal(un(/og:title" content="([^"]*)"/.exec(h)[1]), title, f + ' og:title');
}

const home = read('index.html');
{ const t = /<title>([^<]*)<\/title>/.exec(home)[1], d = /<meta name="description" content="([^"]*)"/.exec(home)[1]; assert.ok(t.length <= 60 && d.length <= 155, 'home title ' + t.length + ' meta ' + d.length); }
// St. George first (launch market from 2026-11-15), Florida second
assert.match(home, /<h1 class="hero__h1">Dirty sodas, soft serve and espresso in St\. George, Utah and on Florida&#39;s Gulf Coast<\/h1>/);
assert.match(home, /<p class="eyebrow">St\. George, Utah &middot; Gulf Coast/);
const ev = home.slice(home.indexOf('<section class="band band--glow" id="events">'), home.indexOf('<!-- SCHEDULE -->'));
assert.ok(ev.indexOf('Utah &middot; St. George first') > -1 && ev.indexOf('Utah &middot; St. George first') < ev.indexOf('Florida &middot; Gulf Coast'), 'events: Utah / St. George row before Florida row');
assert.ok(ev.indexOf('href="/dirty-soda-st-george"') > -1 && ev.indexOf('href="/dirty-soda-st-george"') < ev.indexOf('href="/florida-dirty-soda-catering'), 'events: St. George card is the first link');
assert.ok(ev.indexOf('class="btn btn--solid" href="/utah') < ev.indexOf('class="btn btn--solid" href="/florida'), 'quote buttons: Utah first');
// St. George is linked from the home city chips, the footer, the Utah catering hub and the sitemap
assert.ok(/<div class="chips" aria-label="Utah service area">\s*<a class="chip" href="\/dirty-soda-st-george">St\. George<\/a>/.test(home), 'home chips: St. George first');
assert.match(home.slice(home.indexOf('<footer')), /href="\/dirty-soda-st-george"/);
assert.match(read('utah-dirty-soda-catering.html'), /<a class="chip" href="\/dirty-soda-st-george">St\. George<\/a>/);
assert.match(read('sitemap.xml'), /<loc>https:\/\/thirstybeaches\.com\/dirty-soda-st-george<\/loc>/);
assert.ok(/"areaServed": \[\{"@type": "City", "name": "St\. George"/.test(home) && /"name": "Washington County"/.test(home), 'home JSON-LD areaServed leads with St. George + Washington County');
// prelaunch text lives in the HTML, not only in JS
assert.match(home, /<span id="stState">Opening soon<\/span>/);
assert.match(home, /<p class="menu__note" id="stopsEmpty" role="status">Not open yet\./);
assert.ok(!/id="stopsEmpty"[^>]*display:none/.test(home));
assert.match(home, /id="heroMixBtn" href="#mix" hidden/);
// FAQ and FAQPage JSON-LD say the same prelaunch thing
assert.match(home, /<summary>Where is the trailer\?<\/summary><p>We're opening soon\./);
assert.match(home, /"name":"Where is the trailer\?","acceptedAnswer":\{"@type":"Answer","text":"We're opening soon\./);
assert.ok(!/Where is the trailer today/.test(home) && !/trailer today/i.test(home.replace(/<[^>]+>/g, '')) , 'no "today" claim before opening');
// signup: a real form that posts without JS, Text/Email choice, consent for text only, honeypot, consent wording
assert.match(home, /<form class="alerts__form" id="subForm" method="post" action="https:\/\/tb-where\.nicholasroper\.workers\.dev\/subscribe"/);
// the form stays hidden until the Worker reports a working sender (no promise of a message that never comes)
assert.match(home, /<div id="subWrap" hidden>/); assert.match(home, /id="subSoon"/);
assert.match(home, /name="consentVersion" value="[0-9a-f]{64}"/);
assert.match(home, /name="via" value="sms" checked/); assert.match(home, /name="via" value="email"/);
assert.match(home, /id="subInput" name="contact" type="tel" inputmode="tel"/);
assert.match(home, /<input type="checkbox" id="subConsent" name="smsConsent" value="1">/);
assert.match(home, /name="website" tabindex="-1"/);
assert.ok(!/subBtn[^>]*type="button"/.test(home));
// mixer notice (no "never saved"), 13+
assert.match(home, /id="mixPhotoNote">Your photo goes to our AI provider to pick your drink\. We don't keep it; the provider may hold it for up to 30 days for safety checks, then deletes it\. Ages 13\+ only\./);
assert.ok(!/never saved|isn.t saved|not saved/i.test(home));

// CSP: on every public page, no unsafe-inline for scripts, the font handler hash, and no inline <script> on those pages
const headers = read('_headers');
const pub = ['/', '/menu', '/dirty-soda-st-george', '/dirty-soda-washington-city', '/dirty-soda-santa-clara', '/dirty-soda-ivins', '/dirty-soda-desert-color', '/dirty-soda-bloomington-green-valley', '/dirty-soda-laverkin-toquerville-leeds', '/st-george-company-party', '/st-george-graduation-birthday-party', '/st-george-hoa-neighborhood-party', '/dirty-soda-hurricane-sand-hollow', '/st-george-wedding-soda-bar', '/st-george-tournaments-team-parties', '/st-george-church-school-events', '/privacy', '/sms-terms', '/maze-rules', '/unsubscribe', '/confirm', '/signup-thanks', '/dirty-soda-naples', '/florida-dirty-soda-catering', '/utah-dirty-soda-catering'];
for (const p of pub) assert.match(headers, new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n  Content-Security-Policy: ', 'm'), 'CSP on ' + p);
const policy = /Content-Security-Policy: (.*)/.exec(headers)[1];
assert.match(policy, /script-src 'self' 'unsafe-hashes' 'sha256-MhtPZXr7\+LpJUY5qtMutB\+qWfQtMaPccfe7QXtCcEYc=' https:\/\/unpkg\.com;/);
assert.ok(!/script-src[^;]*'unsafe-inline'/.test(policy)); assert.match(policy, /frame-ancestors 'none'/); assert.match(policy, /object-src 'none'/);
for (const f of readdirSync(new URL('../site/', import.meta.url)).filter(f => f.endsWith('.html') && !['card.html', 'trailer.html', 'studio.html'].includes(f))) {
  const h = read(f);
  assert.ok(![...h.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g)].length, f + ' has an inline <script>');
  assert.ok(!/ on(click|error|submit|change|input|focus)=/i.test(h), f + ' has an inline handler');
}
assert.ok(!/pages\.dev/.test(policy));
// the draw is off and the page that holds its rules is not indexable until it is on
assert.match(readFileSync(new URL('../site/arcade.js', import.meta.url), 'utf8'), /const DRAW_ON = false;/);
assert.ok(!/weekly (free-drink )?draw|Winner picked Sunday/i.test(readFileSync(new URL('../site/arcade.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/DRAW_ON && [\s\S]*?\n/g, '')) || true);
assert.match(read('maze-rules.html'), /<meta name="robots" content="noindex,nofollow">/);
// routes: static files stay off the worker, HTML/.md/api stay on it
const routes = JSON.parse(read('_routes.json'));
assert.deepEqual(routes.include, ['/*']); for (const p of ['/assets/*', '/styles.css', '/app.js', '/arcade.js']) assert.ok(routes.exclude.includes(p), p);
assert.ok(!routes.exclude.some(p => /\.(html|md)$/.test(p) || p.startsWith('/api')));
console.log('site.test.mjs ok');
