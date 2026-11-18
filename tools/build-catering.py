#!/usr/bin/env python3
"""Builds the Utah catering pages in site/ (hub + event-type pages).

Edit PRICES / PHONE below, then run:  python3 tools/build-catering.py
Pages are plain static HTML afterwards; nothing here runs on the server.
"""
import json, html, pathlib

SITE = pathlib.Path(__file__).resolve().parent.parent / 'site'
BASE = 'https://thirstybeaches.com'
CSS_V = 'ux20261025'
OG = BASE + '/assets/og.jpg?v=logo20261018'
LASTMOD = '2026-10-17'

# ── fill these in ──────────────────────────────────────────────────────────────
# Starting price shown on each package card, e.g. '$450'. None shows "Priced per event".
PRICES = {'sip': None, 'beach': None, 'endless': None}
# Phone/text number for events, e.g. '+18015550123' -> adds Call/Text buttons + schema telephone.
PHONE = None
# ───────────────────────────────────────────────────────────────────────────────

def esc(s): return html.escape(s, quote=True)

def price_line(key):
    p = PRICES.get(key)
    return f'Starting at {esc(p)}' if p else 'Priced per event &middot; quote in 1 business day'

FONT = 'https://fonts.googleapis.com/css2?family=Bungee&family=Archivo:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap'

def head(slug, title, desc, schema, book='/utah-dirty-soda-catering'):
    url = f'{BASE}/{slug}'
    ld = ''.join(f'<script type="application/ld+json">{json.dumps(s, ensure_ascii=False)}</script>\n' for s in schema)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="theme-color" content="#08011C">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/icon-192.png?v=logo20261018">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://tb-where.nicholasroper.workers.dev" crossorigin>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Thirsty">
<link rel="apple-touch-icon" href="/assets/icon-192.png?v=logo20261018">
<link rel="preload" as="style" href="{FONT}">
<link rel="stylesheet" href="{FONT}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="{FONT}"></noscript>
<link rel="stylesheet" href="/styles.css?v={CSS_V}">
<link rel="canonical" href="{url}">
{ld}<meta property="og:site_name" content="Thirsty Beaches">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{OG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Thirsty Beaches neon logo: a cup with a straw, palm trees and a wave, with the Stay Thirsty, Beaches tagline.">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{OG}">
</head>
<body>

<a class="skip" href="#main">Skip to the content</a>
<div class="glow" aria-hidden="true"></div>

<nav class="nav">
  <a class="nav__mark" href="/" aria-label="Thirsty Beaches home"><picture><source type="image/webp" srcset="/assets/logo-nav.webp?v=logo20261018 1x, /assets/logo-nav@2x.webp?v=logo20261018 2x"><img src="/assets/logo-nav.png?v=logo20261018" srcset="/assets/logo-nav.png?v=logo20261018 1x, /assets/logo-nav@2x.png?v=logo20261018 2x" width="158" height="96" alt="Thirsty Beaches"></picture></a>
  <div class="nav__links">
    <a href="/menu">Menu</a>
    <a href="/#build">Build</a>
    <a href="/#find">Find Us</a>
    <a href="/#stops">Stops</a>
    <a class="nav__card" href="/card">Punch Card</a>
    <a class="nav__book" href="{book}"{' aria-current="page"' if '/'+slug==book else ''}>Book</a>
  </div>
</nav>
'''

def tail():
    phone = ''
    if PHONE:
        phone = f'<a class="btn btn--ghost" href="sms:{PHONE}">Text Us</a>'
    return f'''
<div class="bookbar is-hidden" aria-label="Book the trailer">
  <a class="btn btn--solid" href="#quote">Get a Quote</a>
  {phone or '<a class="btn btn--ghost" href="/menu">See the Menu</a>'}
</div>

{FOOT}

<button class="fxbtn" id="vhsBtn" type="button" aria-pressed="false">VHS mode</button>
<script src="/app.js?v=ux20261025" defer></script>
<script src="/quote.js?v={CSS_V}" defer></script>
<script src="/sw-register.js" defer></script>
</body>
</html>
'''

EVENTS = ['Wedding or reception', 'School or PTA event', 'Church or ward event', 'Company party',
          'Team party or tournament', 'Fundraiser', 'Birthday or graduation', 'Market or festival', 'Something else']
# Florida: no Utah/LDS "ward" wording; adds HOA/condo socials (see the Florida event cards)
# St. George: adds HOA/neighborhood parties (round two page /st-george-hoa-neighborhood-party)
EVENTS_SG = ['Wedding or reception', 'Birthday or graduation', 'HOA or neighborhood party', 'Church or ward event', 'School or PTA event',
             'Team party or tournament', 'Company party', 'Fundraiser', 'Market or festival', 'Something else']
EVENTS_FL = ['Wedding or reception', 'School or PTA event', 'Church or youth event', 'HOA or condo social',
             'Company party', 'Fundraiser', 'Birthday or graduation', 'Market or festival', 'Something else']

def form(preset, heading='Get a quote', lede=None, city_ph='Lehi, Thanksgiving Point', phone_ph='(801) 555-5555', events=EVENTS):
    opts = ''.join(f'<option{" selected" if e==preset else ""}>{esc(e)}</option>' for e in events)
    lede = lede or 'Tell us the basics and we&rsquo;ll reply within one business day with availability and a price. No deposit, no obligation.'
    call = ''
    if PHONE:
        call = f' Rather talk? <a href="tel:{PHONE}">Call</a> or <a href="sms:{PHONE}">text</a> us.'
    return f'''
<section class="band band--glow" id="quote">
  <div class="wrap">
    <p class="eyebrow">Book the trailer</p>
    <h2 class="h2">{heading}</h2>
    <p class="lede">{lede}</p>
    <form class="quote" id="quoteForm" novalidate>
      <div class="quote__alert" role="alert" tabindex="-1" hidden></div>
      <div class="quote__grid">
        <label class="qf"><span>Your name <b>*</b></span><input name="name" autocomplete="name" required></label>
        <label class="qf"><span>Email <b>*</b></span><input name="email" type="email" autocomplete="email" inputmode="email" required></label>
        <label class="qf"><span>Phone</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="{phone_ph}"></label>
        <label class="qf"><span>Kind of event <b>*</b></span><select name="event" required><option value="">Pick one</option>{opts}</select></label>
        <label class="qf"><span>Event date <b>*</b></span><input name="date" type="date" required></label>
        <label class="qf"><span>Guests <b>*</b></span><select name="guests" required><option value="">How many?</option><option>Under 50</option><option>50&ndash;100</option><option>100&ndash;200</option><option>200&ndash;400</option><option>400+</option></select></label>
        <label class="qf quote__full"><span>City or venue <b>*</b></span><input name="city" autocomplete="address-level2" placeholder="{city_ph}" required></label>
      </div>
      <details class="quote__more">
        <summary>More details <span>(optional)</span></summary>
        <div class="quote__grid">
          <label class="qf"><span>How long</span><select name="hours"><option value="">Not sure yet</option><option>1 hour</option><option>2 hours</option><option>3 hours</option><option>4+ hours</option></select></label>
          <label class="qf"><span>Who&rsquo;s paying for drinks</span><select name="pay"><option value="">Not sure yet</option><option>We&rsquo;ll cover everyone</option><option>Guests buy their own</option><option>A mix (a tab, then guests pay)</option></select></label>
          <fieldset class="qf quote__full"><legend>What sounds good</legend>
            <div class="qf__opts">
              <label><input type="checkbox" name="services" value="Dirty sodas" checked> Dirty sodas</label>
              <label><input type="checkbox" name="services" value="Soft serve &amp; floats"> Soft serve &amp; floats</label>
              <label><input type="checkbox" name="services" value="Espresso"> Espresso &amp; cold brew</label>
              <label><input type="checkbox" name="services" value="Kid sizes"> Kid sizes</label>
            </div>
          </fieldset>
          <label class="qf quote__full"><span>Anything else</span><textarea name="notes" rows="4" placeholder="Times, theme colors, a drink you want named after you, parking or power at the venue&hellip;"></textarea></label>
        </div>
      </details>
      <label class="quote__hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <div class="quote__foot">
        <button class="btn btn--solid" type="submit">Get My Quote</button>
        <p class="quote__fine">We only use this to answer your request.{call}</p>
      </div>
      <p class="quote__msg" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>
'''

def pkgs(intro_h='Pick your pour', lede='Three ways to bring the trailer. Every package can be trimmed or stretched, and we&rsquo;ll price yours exactly in the quote.'):
    return f'''
<section class="band" id="packages">
  <div class="wrap">
    <p class="eyebrow">Packages</p>
    <h2 class="h2">{intro_h}</h2>
    <p class="lede">{lede}</p>
    <div class="pkgs">
      <article class="pkg">
        <span class="pkg__tag">Dirty soda bar</span>
        <h3>Sip &amp; Go</h3>
        <p class="pkg__price">{price_line('sip')}</p>
        <ul><li>6&ndash;8 dirty sodas you pick from the menu</li><li>Zero-sugar and kid sizes on request</li><li>About 2 hours of service</li><li>Good for classrooms, showers, office afternoons</li></ul>
        <a class="btn btn--ghost" href="#quote">Quote This</a>
      </article>
      <article class="pkg pkg--pop">
        <span class="pkg__tag">The full trailer</span>
        <h3>Full Beach</h3>
        <p class="pkg__price">{price_line('beach')}</p>
        <ul><li>Dirty sodas plus real soft serve</li><li>Floats, cones and cups for the non-soda crowd</li><li>2&ndash;3 hours of service</li><li>Good for weddings, school nights, company parties</li></ul>
        <a class="btn btn--solid" href="#quote">Quote This</a>
      </article>
      <article class="pkg">
        <span class="pkg__tag">Everything we pour</span>
        <h3>Endless Summer</h3>
        <p class="pkg__price">{price_line('endless')}</p>
        <ul><li>Dirty sodas, soft serve and fresh espresso</li><li>A custom drink named for your event</li><li>3+ hours of service</li><li>Good for receptions, festivals, all-day events</li></ul>
        <a class="btn btn--ghost" href="#quote">Quote This</a>
      </article>
    </div>
    <p class="menu__note" style="margin-top:1.2rem">Hosting a market or fundraiser where guests buy their own drinks? Ask about a pop-up stop instead of a package.</p>
  </div>
</section>
'''

def faq(items):
    # questions are authored HTML (entities like &rsquo;), same as answers: don't escape them twice
    body = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in items)
    return f'''
<section class="band" id="faq">
  <div class="wrap">
    <p class="eyebrow">Questions</p>
    <h2 class="h2">Before you book</h2>
    <div class="faq">{body}</div>
  </div>
</section>
'''

def faq_schema(items):
    import re
    strip = lambda s: re.sub(r'<[^>]+>', '', html.unescape(s))
    return {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': strip(q), 'acceptedAnswer': {'@type': 'Answer', 'text': strip(a)}} for q, a in items]}

UT_AREAS = ['St. George', 'Washington', 'Santa Clara', 'Ivins', 'Hurricane', 'Lehi', 'American Fork', 'Pleasant Grove', 'Saratoga Springs', 'Eagle Mountain', 'Orem', 'Provo',
            'Draper', 'Sandy', 'South Jordan', 'Salt Lake City']
UT_ADMIN = ['Washington County', 'Utah County', 'Salt Lake County']
FL_AREAS = ['Tampa', 'St. Petersburg', 'Clearwater', 'Bradenton', 'Sarasota', 'Venice', 'Fort Myers', 'Cape Coral', 'Naples']
FL_ADMIN = ['Hillsborough County', 'Pinellas County', 'Manatee County', 'Sarasota County', 'Lee County', 'Collier County']

# St. George / Washington County (launch market). areaServed only: no street address until the trailer is based there,
# no openingHoursSpecification until public stops are real.
UTAH = {'@type': 'State', 'name': 'Utah'}
SG_AREA_SERVED = [{'@type': 'City', 'name': 'St. George', 'containedInPlace': UTAH},
                  {'@type': 'City', 'name': 'Washington', 'alternateName': 'Washington City', 'containedInPlace': UTAH},
                  {'@type': 'City', 'name': 'Ivins', 'containedInPlace': UTAH},
                  {'@type': 'City', 'name': 'Santa Clara', 'containedInPlace': UTAH},
                  {'@type': 'City', 'name': 'Hurricane', 'containedInPlace': UTAH},
                  {'@type': 'AdministrativeArea', 'name': 'Washington County', 'containedInPlace': UTAH}]

def service_schema(slug, name, desc, service_type, region='utah'):
    biz = {'@type': 'FoodEstablishment', '@id': BASE + '/#business', 'name': 'Thirsty Beaches', 'url': BASE + '/',
           'email': 'hello@thirstybeaches.com', 'image': OG, 'hasMenu': BASE + '/menu'}
    if region == 'utah': biz['address'] = {'@type': 'PostalAddress', 'addressLocality': 'Lehi', 'addressRegion': 'UT', 'addressCountry': 'US'}
    elif region == 'florida': biz['address'] = {'@type': 'PostalAddress', 'addressRegion': 'FL', 'addressCountry': 'US'}
    if PHONE: biz['telephone'] = PHONE
    if region == 'stgeorge': area = SG_AREA_SERVED
    else: area = ([{'@type': 'City', 'name': c} for c in (UT_AREAS if region == 'utah' else FL_AREAS)] +
                  [{'@type': 'AdministrativeArea', 'name': n} for n in (UT_ADMIN if region == 'utah' else FL_ADMIN)])
    return {'@context': 'https://schema.org', '@type': 'Service', 'name': name, 'serviceType': service_type,
            'description': desc, 'url': f'{BASE}/{slug}', 'provider': biz,
            'areaServed': area,
            'offers': {'@type': 'Offer', 'url': f'{BASE}/{slug}#quote', 'availability': 'https://schema.org/InStock'}}

def crumbs_schema(trail):
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': BASE + u} for i, (n, u) in enumerate(trail)]}

def hero(trail_html, h1, lede, extra=''):
    return f'''
<main id="main">
<section class="band band--glow cat-hero">
  <div class="wrap">
    <p class="crumbs">{trail_html}</p>
    <p class="soon soon--go">Now taking event requests</p>
    <h1 class="h2">{h1}</h1>
    <p class="lede">{lede}</p>
    <div class="actions">
      <a class="btn btn--solid" href="#quote">Get a Quote</a>
      <a class="btn btn--ghost" href="#packages">See Packages</a>
    </div>
    <ul class="trust"><li>Reply in 1 business day</li><li>114-drink menu, or your short list</li><li>Zero-sugar &amp; kid sizes</li>{extra}</ul>
  </div>
</section>
'''

EVENT_LINKS = [('Weddings &amp; receptions', '/dirty-soda-wedding-catering-utah', 'Receptions, showers, open houses'),
               ('Schools, churches &amp; fundraisers', '/dirty-soda-school-church-events-utah', 'PTA nights, ward parties, teacher thank-yous'),
               ('Company parties', '/dirty-soda-company-party-utah', 'Office treat days, launches, summer parties')]

def more_events(skip=None):
    cards = ''.join(f'<a class="card" href="{u}"><span class="card__tag">Events</span><h3>{n}</h3><p>{p}</p></a>'
                    for n, u, p in EVENT_LINKS if u != skip)
    cards += '<a class="card" href="/utah-dirty-soda-catering"><span class="card__tag">All events</span><h3>Utah catering</h3><p>Packages, service area and FAQ</p></a>' if skip else ''
    return cards

AREA = '''
<section class="band" id="area">
  <div class="wrap">
    <p class="eyebrow">Service area</p>
    <h2 class="h2">Where we&rsquo;ll bring it</h2>
    <p class="lede">We open first in St. George and Washington County, and we book events across Utah County and Salt Lake County too. Further out, like Cedar City, Park City or Ogden, just ask and we&rsquo;ll quote the drive.</p>
    <div class="chips" style="justify-content:flex-start">
      <a class="chip" href="/dirty-soda-st-george">St. George</a><a class="chip" href="/dirty-soda-washington-city">Washington City</a><a class="chip" href="/dirty-soda-santa-clara">Santa Clara</a><a class="chip" href="/dirty-soda-ivins">Ivins</a><a class="chip" href="/dirty-soda-hurricane-sand-hollow">Hurricane</a><a class="chip" href="/dirty-soda-lehi">Lehi</a><a class="chip" href="/dirty-soda-utah-county">Utah County</a><a class="chip" href="/dirty-soda-utah-county">Provo &amp; Orem</a><a class="chip" href="/dirty-soda-salt-lake-city">Salt Lake City</a><span class="chip">American Fork</span><span class="chip">Saratoga Springs</span><span class="chip">Draper</span><span class="chip">Sandy</span><span class="chip">South Jordan</span>
    </div>
  </div>
</section>
'''

SG_EVENT_LINKS = [('Weddings &amp; receptions', '/st-george-wedding-soda-bar', 'Southern Utah receptions, open houses and showers'),
                  ('Graduations &amp; birthdays', '/st-george-graduation-birthday-party', 'Open houses, kids&rsquo; birthdays, milestone parties'),
                  ('HOA &amp; neighborhood parties', '/st-george-hoa-neighborhood-party', 'Pool days, block parties, 55+ clubhouse socials'),
                  ('Church &amp; school events', '/st-george-church-school-events', 'Ward parties, homecomings, PTA nights, teacher thank-yous'),
                  ('Tournaments &amp; team parties', '/st-george-tournaments-team-parties', 'Tournament weekends, season-end parties, boosters'),
                  ('Company parties', '/st-george-company-party', 'Employee thank-yous, shift-change treats, open houses')]

def sg_more_events(skip=None):
    cards = ''.join(f'<a class="card" href="{u}"><span class="card__tag">St. George</span><h3>{n}</h3><p>{p}</p></a>'
                    for n, u, p in SG_EVENT_LINKS if u != skip)
    # event pages: the other 5 + the St. George card (6, .cards--3); the hub row: all 6, with the town chips under it
    return cards + ('<a class="card" href="/dirty-soda-st-george"><span class="card__tag">Southern Utah</span><h3>Dirty soda in St. George</h3><p>The trailer, the heat and Washington County</p></a>' if skip else '')

SG_AREA = '''
<section class="band" id="area">
  <div class="wrap">
    <p class="eyebrow">Service area</p>
    <h2 class="h2">Around St. George</h2>
    <p class="lede">St. George is where we open first, and the trailer covers all of Washington County. Further out, like Cedar City or Springdale, just ask and we&rsquo;ll put any travel in the quote.</p>
    <div class="chips" style="justify-content:flex-start">
      <a class="chip" href="/dirty-soda-st-george">St. George</a><a class="chip" href="/dirty-soda-desert-color">Desert Color</a><a class="chip" href="/dirty-soda-bloomington-green-valley">Bloomington &amp; Green Valley</a><a class="chip" href="/dirty-soda-washington-city">Washington City</a><a class="chip" href="/dirty-soda-santa-clara">Santa Clara</a><a class="chip" href="/dirty-soda-ivins">Ivins</a><a class="chip" href="/dirty-soda-hurricane-sand-hollow">Hurricane &amp; Sand Hollow</a><a class="chip" href="/dirty-soda-laverkin-toquerville-leeds">LaVerkin, Toquerville &amp; Leeds</a><a class="chip" href="/utah-dirty-soda-catering">All of Utah</a>
    </div>
  </div>
</section>
'''

def page(slug, title, desc, h1, lede, trail, sections, faq_items, preset, svc_name, svc_type, form_heading='Get a quote', form_lede=None, extra_trust='', region='utah'):
    trail_html = ' &middot; '.join(f'<a href="{u}">{n}</a>' if i < len(trail) - 1 else n for i, (n, u) in enumerate(trail))
    schema = [service_schema(slug, svc_name, desc, svc_type, region), crumbs_schema([(html.unescape(n), u) for n, u in trail]), faq_schema(faq_items)]
    fl = region == 'florida'
    out = (head(slug, title, desc, schema, FL_HUB_URL if fl else '/' + HUB) + hero(trail_html, h1, lede, extra_trust) + sections + faq(faq_items)
           + form(preset, form_heading, form_lede, *(('Sarasota, Siesta Key', '(941) 555-5555', EVENTS_FL) if fl else
                                                     ('St. George, Little Valley', '(435) 555-5555', EVENTS_SG) if region == 'stgeorge' else ()))
           + '</main>\n' + tail())
    (SITE / f'{slug}.html').write_text(out)
    print('wrote', slug, len(out))

HUB = 'utah-dirty-soda-catering'
FL_HUB = 'florida-dirty-soda-catering'
FL_HUB_URL = '/' + FL_HUB
T0 = [('Thirsty Beaches', '/'), ('Utah catering', '/' + HUB)]
TSG = [('Thirsty Beaches', '/'), ('St. George', '/dirty-soda-st-george')]

def build():
    global FOOT
    FOOT = (pathlib.Path(__file__).resolve().parent / 'partials' / 'footer.html').read_text().strip()

    # ── hub ──
    hub_sections = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">What shows up</p>
    <h2 class="h2">A soda shop that parks at your party</h2>
    <div class="about">
      <p>Thirsty Beaches is a retro drink trailer that brings the whole Utah dirty soda experience to your event: fountain soda over nugget ice, real syrups and fruit pur&eacute;es, a pour of cream, and every drink built to order. Then it does the two things a drive-thru can&rsquo;t. We run real soft serve, so any soda can turn into a float, and we pull fresh espresso for lattes and sweet-cream cold brew.</p>
      <p>You pick the menu. Run the full 114-drink board, or choose a short list of crowd favorites like the Thirst Trap (Dr Pepper, coconut, sweet cream) so the line keeps moving. Zero-sugar versions, caffeine-free lemonades and Italian sodas, and kid sizes mean the grandparents, the toddlers and the Diet Coke loyalists all get something.</p>
    </div>
  </div>
</section>
{pkgs()}
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Events we do</p>
    <h2 class="h2">Built for Utah parties</h2>
    <div class="cards cards--links">{more_events()}
      <a class="card" href="?event=birthday#quote"><span class="card__tag">Also</span><h3>Birthdays &amp; graduations</h3><p>Backyard parties, open houses, missionary farewells and homecomings</p></a>
      <a class="card" href="?event=market#quote"><span class="card__tag">Also</span><h3>Markets &amp; festivals</h3><p>Pop-up stops where guests buy their own drinks</p></a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <p class="eyebrow">Southern Utah first</p>
    <h2 class="h2">St. George and Washington County</h2>
    <p class="lede">The trailer opens first in St. George. Start with <a href="/dirty-soda-st-george">dirty soda in St. George</a>, or go straight to your kind of event or your part of the county.</p>
    <div class="cards cards--links cards--3">{sg_more_events()}</div>
    <p class="eyebrow" style="margin-top:2rem">Towns and neighborhoods</p>
    <div class="chips" style="justify-content:flex-start">
      <a class="chip" href="/dirty-soda-st-george">St. George</a><a class="chip" href="/dirty-soda-desert-color">Desert Color</a><a class="chip" href="/dirty-soda-bloomington-green-valley">Bloomington &amp; Green Valley</a><a class="chip" href="/dirty-soda-washington-city">Washington City</a><a class="chip" href="/dirty-soda-santa-clara">Santa Clara</a><a class="chip" href="/dirty-soda-ivins">Ivins</a><a class="chip" href="/dirty-soda-hurricane-sand-hollow">Hurricane &amp; Sand Hollow</a><a class="chip" href="/dirty-soda-laverkin-toquerville-leeds">LaVerkin, Toquerville &amp; Leeds</a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <p class="eyebrow">How it works</p>
    <h2 class="h2">Three steps to a dirty soda bar</h2>
    <div class="steps">
      <div class="step"><h3>Send the basics</h3><p>Date, place, head count. Takes a minute with the form below.</p></div>
      <div class="step"><h3>Get your quote</h3><p>Within one business day: availability, a price and a suggested menu for your crowd.</p></div>
      <div class="step"><h3>We roll up</h3><p>We arrive early, set up and pour. You enjoy your event, then we pack out and leave the spot clean.</p></div>
    </div>
  </div>
</section>
{AREA}'''
    hub_faq = [
        ('How far ahead should I book?', 'For weddings and big Saturdays, the sooner the better. A month or more out is ideal. For smaller events, ask anyway: if the trailer is free, we&rsquo;ll come.'),
        ('Is this a soda truck I can rent for a party?', 'Pretty much. It&rsquo;s a retro soda trailer we tow to your event and run ourselves, so you get a full mobile soda bar with staff, not an empty truck. Birthdays, graduations, reunions, weddings and company parties all work. Tell us the date and head count and we&rsquo;ll quote it.'),
        ('What&rsquo;s the difference between a soda bar and a soda shop?', 'A soda shop is a drive-thru you go to. A soda bar comes to you: we park at your venue, pour drinks to order for every guest, and you don&rsquo;t run anyone through a drive-thru line. Ours adds soft serve and espresso, which most soda shops don&rsquo;t have.'),
        ('How much does dirty soda catering cost?', 'It depends on guest count, hours and what you add (soft serve, espresso). Send the form and you&rsquo;ll get an exact price within one business day, with no deposit needed to ask.'),
        ('Can guests pay for their own drinks?', 'Yes. You can cover everyone, open a tab up to a set amount, or have us run a pop-up where guests buy their own. That last one works well for markets and fundraisers.'),
        ('Can we choose the drinks?', 'Yes. Pick a short list from the <a href="/menu">menu</a>, or let us suggest one for your crowd. We can also name a custom drink after the couple, the school or the company.'),
        ('Do you have options for kids and people avoiding sugar or caffeine?', 'Yes. Most sodas come in a zero-sugar version, lemonades and Italian sodas have no caffeine, and our Beach Babies sizes are made for kids.'),
        ('What do you need from the venue?', 'A flat spot for the trailer close to your guests, and a way to drive a truck and trailer in. We&rsquo;ll confirm parking and power details with you when we quote.'),
        ('Do you travel outside St. George, Utah County and Salt Lake?', 'Often, yes. Tell us where your event is and we&rsquo;ll include any travel in the quote. St. George and Washington County are where we open first: see <a href="/dirty-soda-st-george">dirty soda in St. George</a>. We also do events on Florida&rsquo;s Gulf Coast, Tampa Bay to Naples: see <a href="/florida-dirty-soda-catering">Florida catering</a>.'),
    ]
    page(HUB, 'Dirty Soda Catering in Utah | Thirsty Beaches',
         'Dirty soda bar and soft-serve trailer for Utah weddings, school and church events and company parties, St. George to Salt Lake. Quote in 1 business day.',
         'Dirty soda catering in Utah',
         'Our retro trailer brings dirty sodas, real soft serve and fresh espresso to weddings, school nights, ward parties and company events from St. George to Lehi and Salt Lake. Tell us the date and we&rsquo;ll send a price within one business day.',
         T0, hub_sections, hub_faq, None, 'Dirty soda trailer catering', 'Event catering')

    # ── weddings ──
    slug = 'dirty-soda-wedding-catering-utah'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Weddings</p>
    <h2 class="h2">The reception drink everyone will talk about</h2>
    <div class="about">
      <p>In Utah, the drink bar is often the main event at a reception, and a dirty soda trailer does that job well. Guests line up for a Thirst Trap or a Mountain Dew with mango and watermelon, the kids get soft-serve cones, and the photos look great with a neon-pink trailer in the background.</p>
      <h2 class="h2">Make it yours</h2>
      <p>We&rsquo;ll name a signature drink after the two of you and match the syrups and toppings to your colors, so blush and gold or navy and silver both work. Keep the menu short so the line moves during the rush after the cake, or open the full board for a long open house. Add espresso if your crowd needs a pick-me-up for the late-night dance floor.</p>
      <h2 class="h2">Showers, luncheons and open houses too</h2>
      <p>Bridal showers, ring ceremonies, luncheons and backyard open houses can use the smaller Sip &amp; Go package. Same trailer, shorter list and a smaller bill.</p>
    </div>
  </div>
</section>
{pkgs('Wedding packages', 'Most receptions book Full Beach (sodas and soft serve) or Endless Summer (add espresso and a named drink). Your quote will spell out exactly what&rsquo;s included.')}
<section class="band"><div class="wrap"><p class="eyebrow">More events</p><h2 class="h2">Not a wedding?</h2><div class="cards cards--links">{more_events('/'+slug)}</div></div></section>
{AREA}'''
    fq = [
        ('Can you name a drink after us?', 'Yes. Tell us what the two of you love, and we&rsquo;ll build a signature drink and put your name on it for the night.'),
        ('How many guests can you serve?', 'Every drink is built to order, so for big receptions we&rsquo;ll recommend a short menu and the right number of hours to keep the line moving. Give us your head count in the form and we&rsquo;ll plan around it.'),
        ('Can the drinks match our colors?', 'Often, yes. Syrups, pur&eacute;es and toppings come in a lot of colors. Mention your palette in the notes.'),
        ('Do you do receptions outside Utah County and Salt Lake?', 'Yes. St. George and Washington County are where we open first (see <a href="/st-george-wedding-soda-bar">southern Utah weddings</a>), and venues in Park City, Heber or Ogden are often doable too, and any travel is included up front in your quote.'),
    ]
    page(slug, 'Dirty Soda Bar for Weddings in Utah | Thirsty Beaches',
         'A dirty soda and soft-serve trailer for Utah wedding receptions, showers and open houses. Custom drinks named for the couple. Quote in 1 business day.',
         'Dirty soda bar for Utah weddings',
         'A retro drink trailer at your reception, pouring dirty sodas, soft-serve floats and espresso, with a signature drink named after the two of you. Serving St. George, Lehi, Utah County and Salt Lake.',
         T0 + [('Weddings', '/' + slug)], sec, fq, 'Wedding or reception', 'Dirty soda wedding catering', 'Wedding catering',
         'Check your date', 'Send the date and venue and we&rsquo;ll tell you within one business day whether the trailer is free, with a price for your guest count.',
         '<li>Custom drink for the couple</li>')

    # ── schools / churches / fundraisers ──
    slug = 'dirty-soda-school-church-events-utah'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Schools, churches &amp; fundraisers</p>
    <h2 class="h2">Family-friendly by design</h2>
    <div class="about">
      <p>PTA carnivals, back-to-school nights, teacher appreciation week, ward and stake activities, youth conferences, sports banquets and team fundraisers. These events need a treat that works for every age and every diet, and that&rsquo;s exactly what the trailer does.</p>
      <h2 class="h2">An event menu that&rsquo;s easy to approve</h2>
      <p>We&rsquo;ll put together a short, family-friendly event menu that a principal, a bishop or a PTA board can sign off on quickly. It includes caffeine-free lemonades and Italian sodas, zero-sugar soda versions, kid sizes and soft-serve cones. Caffeine on the menu is optional, and you decide.</p>
      <h2 class="h2">Teacher and staff thank-yous</h2>
      <p>Few things say thank you to a Utah teacher like a dirty soda on a Friday afternoon. Pick the morning or afternoon, we park at the school and pour for the staff, and you cover the tab.</p>
      <h2 class="h2">Fundraisers</h2>
      <p>Raising money for a team, a class trip or a cause? Ask about a fundraiser stop: we park at your event, guests buy their own drinks, and part of the sales goes back to your group. Put &ldquo;fundraiser&rdquo; in the form and we&rsquo;ll send the details.</p>
    </div>
  </div>
</section>
{pkgs('Packages for groups', 'Sip &amp; Go is plenty for most staff treats. Carnivals and big activities usually go with Full Beach so the soft serve can feed the line.')}
<section class="band"><div class="wrap"><p class="eyebrow">More events</p><h2 class="h2">Planning something else?</h2><div class="cards cards--links">{more_events('/'+slug)}</div></div></section>
{AREA}'''
    fq = [
        ('Can we leave caffeine off the menu?', 'Yes. Tell us in the form and we&rsquo;ll build a caffeine-free event menu from lemonades, Italian sodas, caffeine-free soda bases and soft serve.'),
        ('Do you do fundraisers?', 'Yes. Guests buy their own drinks and part of the sales goes back to your group. Mention it in the form and we&rsquo;ll share how it works.'),
        ('Can the school or church pay by invoice?', 'Ask us in the notes and we&rsquo;ll work out what your school or organization needs when we send the quote.'),
        ('Do you have kid sizes?', 'Yes. The Beach Babies menu is sized and priced for kids, and soft-serve cones are always a hit.'),
        ('Do you do church and school events in St. George?', 'Yes. St. George and Washington County are where we open first. See <a href="/st-george-church-school-events">St. George church and school events</a> and <a href="/st-george-tournaments-team-parties">tournaments and team parties</a>.'),
    ]
    page(slug, 'Dirty Soda for Utah School & Church Events | Thirsty Beaches',
         'Family-friendly dirty soda and soft-serve trailer for Utah PTA nights, ward activities, teacher appreciation and fundraisers. Caffeine-free menus too.',
         'Dirty soda for school, church and fundraiser events',
         'A family-friendly drink trailer for PTA nights, ward activities, teacher appreciation days and fundraisers in St. George, Utah County and Salt Lake. Caffeine-free menus and kid sizes included.',
         T0 + [('Schools, churches &amp; fundraisers', '/' + slug)], sec, fq, 'School or PTA event', 'Dirty soda catering for schools, churches and fundraisers', 'Event catering',
         extra_trust='<li>Caffeine-free menus</li>')

    # ── company parties ──
    slug = 'dirty-soda-company-party-utah'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Company events</p>
    <h2 class="h2">The office treat day, upgraded</h2>
    <div class="about">
      <p>Silicon Slopes runs on dirty soda. Bring the trailer to the parking lot for an employee appreciation afternoon, a product launch, a summer party, a client open house or a recruiting event, and give the whole office something worth leaving their desks for.</p>
      <h2 class="h2">Easy for whoever&rsquo;s planning it</h2>
      <p>One form, one quote and a clear price. You pick a window (an afternoon pick-me-up or a full party), cover the tab or cap it, and we handle setup, service and cleanup. Add espresso for morning events, or soft serve for the summer party.</p>
      <h2 class="h2">Company parties in St. George</h2>
      <p>The trailer opens first in St. George and Washington County, where shift-change treats and customer open houses are a big part of the calendar. See <a href="/st-george-company-party">St. George company parties</a>.</p>
      <h2 class="h2">Put your brand on it</h2>
      <p>We&rsquo;ll name a custom drink after your company, your product or your team, and you can keep the drink options to a short list so a big crowd moves quickly.</p>
    </div>
  </div>
</section>
{pkgs('Packages for teams', 'Sip &amp; Go covers most office afternoons. Launches and summer parties usually go Full Beach or Endless Summer.')}
<section class="band"><div class="wrap"><p class="eyebrow">More events</p><h2 class="h2">Planning something else?</h2><div class="cards cards--links">{more_events('/'+slug)}</div></div></section>
{AREA}'''
    fq = [
        ('Can the company cover everyone’s drinks?', 'Yes. Cover the whole team, set a cap, or let us switch to guests paying once the tab runs out.'),
        ('Can you send an invoice?', 'Mention it in the notes and we&rsquo;ll set up billing your company can work with when we send the quote.'),
        ('Do you do morning events?', 'Yes. Add espresso and cold brew with sweet-cream foam for morning all-hands, open houses and client breakfasts.'),
        ('Can we name a drink after our company?', 'Yes. We&rsquo;ll build a custom drink in your brand colors and name it for your company, product or team.'),
    ]
    page(slug, 'Dirty Soda for Utah Company Parties | Thirsty Beaches',
         'Book a dirty soda, soft-serve and espresso trailer for Utah employee appreciation days, launches and company parties in Lehi, Silicon Slopes and Salt Lake.',
         'Dirty soda for Utah company parties',
         'Employee appreciation, product launches and summer parties in Lehi, on Silicon Slopes and across Salt Lake. A retro trailer pouring dirty sodas, soft serve and espresso, with the tab handled however you want.',
         T0 + [('Company parties', '/' + slug)], sec, fq, 'Company party', 'Dirty soda catering for company events', 'Corporate catering',
         extra_trust='<li>Custom company drink</li>')

    # ── St. George event pages (launch market, 2026-11-16) ──
    # Rules: no event dates, no "we'll be at X", no competitor claims; venues set their own vendor rules.
    slug = 'st-george-wedding-soda-bar'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Southern Utah weddings</p>
    <h2 class="h2">A St. George reception, done the Utah way</h2>
    <div class="about">
      <p>A lot of St. George weddings follow the same rhythm: a sealing or ceremony earlier in the day, a family luncheon, then an evening reception or open house where half the neighborhood comes through the line. Most of those receptions are dry, so the drink bar is the bar. In the town where Utah&rsquo;s best-known chain started, dirty soda is the obvious pick, and a trailer that pours to order for every guest turns the drink line into part of the party instead of a table of warm cans.</p>
      <p>Guests line up for a Thirst Trap (Dr Pepper, coconut, sweet cream) or a Mountain Dew with mango and watermelon. The kids get soft-serve cones, the grandparents get a caffeine-free lemonade, and the photographer gets a neon-pink trailer against a red-rock sky.</p>
      <h2 class="h2">Built for receptions in the heat</h2>
      <p>Southern Utah&rsquo;s wedding season runs long. Spring and fall evenings are close to perfect, and summer receptions simply start later, after the sun drops behind the ridge. Every drink is poured over nugget ice, and the soft-serve machine turns any soda into a float, which is hard to beat at a July reception. For daytime summer events we&rsquo;ll suggest a shorter menu and a time window that keeps the line moving, so nobody in a suit waits long on hot pavement.</p>
      <h2 class="h2">Make it yours</h2>
      <p>We&rsquo;ll name a signature drink after the two of you and match the syrups and toppings to your colors, so sage and terracotta or navy and gold both work. Keep the menu to five or six drinks so the rush after the cake moves fast, or open the full board for a long open house. Add espresso for a late dance floor, or sweet-cream cold brew for a morning luncheon.</p>
      <h2 class="h2">Backyards, venues and where the trailer parks</h2>
      <p>We do backyard receptions in Little Valley, Bloomington and Green Valley, family-property open houses in Washington City and Santa Clara, red-rock patios out in Ivins and Kayenta, and receptions out toward Hurricane and the road to Zion. The trailer needs a flat spot that a truck and trailer can pull into, close enough to your guests that the line feels like part of the party. It runs on its own generator and carries its own water.</p>
      <p>One thing to check first: some resort, golf and event venues require all food and drinks to come from their own kitchen. Look at your venue contract or ask your coordinator whether outside food and beverage vendors are allowed. If they are, we&rsquo;ll work with the coordinator on load-in time and parking before we quote. If your reception is in <a href="/dirty-soda-ivins">Ivins</a>, <a href="/dirty-soda-santa-clara">Santa Clara</a> or <a href="/dirty-soda-hurricane-sand-hollow">Hurricane</a>, those pages cover the area, and <a href="/dirty-soda-st-george">dirty soda in St. George</a> covers the rest of the county.</p>
      <h2 class="h2">Showers, luncheons, ring ceremonies and open houses</h2>
      <p>Bridal showers, ring ceremonies, sealing-day luncheons and backyard open houses can use the smaller Sip &amp; Go package: the same trailer, a shorter list and a smaller bill. Missionary-age siblings, cousins from the Wasatch Front and the grandkids all end up at the window, so we always bring kid sizes and zero-sugar versions.</p>
    </div>
  </div>
</section>
{pkgs('Wedding packages', 'Most receptions book Full Beach (sodas and soft serve) or Endless Summer (add espresso and a named drink). Your quote will spell out exactly what&rsquo;s included.')}
<section class="band"><div class="wrap"><p class="eyebrow">More in St. George</p><h2 class="h2">Not a wedding?</h2><div class="cards cards--links cards--3">{sg_more_events('/'+slug)}</div></div></section>
{SG_AREA}'''
    fq = [
        ('Can you name a drink after us?', 'Yes. Tell us what the two of you love, and we&rsquo;ll build a signature drink, match it to your colors and put your names on it for the night.'),
        ('How many guests can you serve at a big St. George reception?', 'Every drink is built to order, so for a reception of a few hundred guests we&rsquo;ll recommend a short menu and the right number of hours. Put your head count in the form and we&rsquo;ll plan around it.'),
        ('Can you serve at our venue in Ivins, Kayenta or Hurricane?', 'If the venue allows outside food and beverage vendors, yes. Some resort and event venues require everything from their own kitchen, so check your contract first. Backyards and family property are the easiest.'),
        ('What about a summer reception?', 'Start after the heat breaks if you can. We pour over nugget ice, soft-serve floats are the favorite, and we&rsquo;ll suggest a menu and a time window that keep the line short.'),
        ('Can guests pay for their own drinks?', 'Most couples cover everyone, but you can also set a cap and switch to guests paying after that. Tell us which you want in the form.'),
        ('How far ahead should we book?', 'For a Saturday reception, the sooner the better. A month or more out is ideal. For a shower or a weeknight open house, ask anyway: if the trailer is free, we&rsquo;ll come.'),
    ]
    page(slug, 'St. George Wedding Dirty Soda Bar, Utah | Thirsty Beaches',
         'A dirty soda and soft-serve trailer for St. George and southern Utah receptions, open houses and showers, with a drink named for the couple.',
         'Dirty soda bar for St. George and southern Utah weddings',
         'A retro drink trailer at your reception, pouring dirty sodas, soft-serve floats and espresso, with a signature drink named after the two of you. Backyards in St. George, red-rock patios in Ivins and Kayenta, and receptions across Washington County.',
         TSG + [('Weddings', '/' + slug)], sec, fq, 'Wedding or reception', 'Dirty soda wedding catering in St. George', 'Wedding catering',
         'Check your date', 'Send the date and venue and we&rsquo;ll tell you within one business day whether the trailer is free, with a price for your guest count.',
         '<li>Custom drink for the couple</li>', region='stgeorge')

    slug = 'st-george-tournaments-team-parties'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Tournaments &amp; team parties</p>
    <h2 class="h2">St. George is a tournament town</h2>
    <div class="about">
      <p>When the Wasatch Front is cold, teams come south. St. George&rsquo;s fields and courts fill up through the cooler months with softball and baseball, soccer and lacrosse, pickleball and youth mountain biking, and families drive down from Salt Lake, Las Vegas and Arizona to spend the weekend on the sidelines. The Fields at Little Valley, the Canyons Softball Complex and the trail park in Desert Color are the kind of places where a cold drink between games is worth a lot.</p>
      <p>That&rsquo;s the crowd we built the trailer for. Parents at a 7&nbsp;a.m. first game want an iced latte. Players want a float after the last out. Little siblings want anything blue. We pour all of it to order from one retro trailer.</p>
      <h2 class="h2">For tournament directors and complex managers</h2>
      <p>The simplest setup is a pop-up where families buy their own drinks, so it costs your event nothing. The trailer runs on its own generator and carries its own water, so we don&rsquo;t need a hookup. Tell us what your venue requires, such as a vendor application, a certificate of insurance or a health permit, and we&rsquo;ll confirm we can meet it before we quote. Some complexes have their own concession stand or an exclusive vendor; we&rsquo;ll check that first, and we won&rsquo;t set up next to your stand without your say-so.</p>
      <p>We only post a public stop once it&rsquo;s actually booked, so if you&rsquo;d like the trailer at your tournament, get in touch early and we&rsquo;ll work out the details with you and the venue.</p>
      <h2 class="h2">Team parties after the last game</h2>
      <p>End-of-season parties, a post-tournament celebration at a park pavilion, a team dinner in a backyard, a coaches&rsquo; thank-you. The team or the club covers a tab (all of it, or up to a set amount), we park, and every player gets a drink their way. Floats and soft-serve cones tend to win. We have kid sizes for the younger teams and zero-sugar sodas for the parents keeping count.</p>
      <h2 class="h2">Booster club and team fundraisers</h2>
      <p>Raising money for a travel season, new uniforms or a team trip? Ask about a fundraiser stop: we park at your event, families buy their own drinks, and part of the sales goes back to your team or booster club. Put &ldquo;fundraiser&rdquo; in the form and we&rsquo;ll send the details.</p>
      <h2 class="h2">What we need at the field</h2>
      <p>A flat spot a truck and trailer can pull into, close to where families walk between fields but out of the fire lanes and the parking aisles. We arrive well before the first game, set up the ordering kiosk and the window, and pack out after the last one, leaving the spot clean. If the venue wants us in a particular lot or behind a particular backstop, tell us when you send the details and we&rsquo;ll plan around it.</p>
      <h2 class="h2">Early games, hot afternoons</h2>
      <p>Tournament days in St. George can start cold and end hot. We open the morning with espresso and sweet-cream cold brew, then switch to dirty sodas, lemonades and floats as the day warms up, all over nugget ice. Caffeine-free lemonades and Italian sodas are on every menu. One honest note: a dirty soda is a treat, not a sports drink, so keep the water jugs on the bench. More about the trailer and the rest of the county on <a href="/dirty-soda-st-george">dirty soda in St. George</a>.</p>
    </div>
  </div>
</section>
{pkgs('Packages for teams', 'Sip &amp; Go is plenty for a team party. Tournament days usually work best as a pop-up where families buy their own, or Full Beach if the club is covering everyone.')}
<section class="band"><div class="wrap"><p class="eyebrow">More in St. George</p><h2 class="h2">Planning something else?</h2><div class="cards cards--links cards--3">{sg_more_events('/'+slug)}</div></div></section>
{SG_AREA}'''
    fq = [
        ('Can you come to a tournament at Little Valley or the Canyons complex?', 'If the tournament director and the venue approve a food vendor for that event, yes. Tell us the tournament and the dates, and we&rsquo;ll check the vendor rules before we quote.'),
        ('Can parents and players pay for their own drinks?', 'Yes. A pop-up where families buy their own is the usual setup for tournaments. For team parties, the team or club can cover a tab instead.'),
        ('Do you need power or water from the venue?', 'No. The trailer runs on its own generator and carries its own water. We just need a flat spot a truck and trailer can pull into.'),
        ('Do you do team and booster club fundraisers?', 'Yes. Families buy their own drinks and part of the sales goes back to your team. Mention it in the form and we&rsquo;ll share how it works.'),
        ('Do you have caffeine-free drinks for players?', 'Yes. Lemonades, Italian sodas and several soda bases have no caffeine, and you can ask for a caffeine-free menu for a team party.'),
        ('Can you do an early-morning game?', 'Yes. We pull espresso to order, so iced lattes and sweet-cream cold brew are ready for the first game of the day.'),
    ]
    page(slug, 'St. George Tournament Drinks, Team Parties | Thirsty Beaches',
         'Dirty sodas, soft-serve floats and espresso for St. George tournament weekends, end-of-season team parties and booster fundraisers. Self-powered trailer.',
         'Dirty soda for St. George tournaments and team parties',
         'Tournament weekends, end-of-season parties and booster fundraisers across Washington County. A retro trailer with dirty sodas, soft-serve floats and espresso for the 7&nbsp;a.m. parents, on its own power and water.',
         TSG + [('Tournaments &amp; team parties', '/' + slug)], sec, fq, 'Team party or tournament', 'Dirty soda for tournaments and team parties in St. George', 'Event catering',
         extra_trust='<li>Own power &amp; water</li>', region='stgeorge')

    slug = 'st-george-church-school-events'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Church &amp; school events</p>
    <h2 class="h2">Ward parties, youth nights and homecomings</h2>
    <div class="about">
      <p>Washington County&rsquo;s calendar is full of church activities: ward parties and Christmas parties, Pioneer Day picnics, trunk-or-treats, youth nights, youth conferences, trek send-offs, and the missionary farewells and homecomings that bring the whole family to one backyard. A drink trailer turns any of them into an event people talk about, and in the town where Utah&rsquo;s best-known chain started, a dirty soda is the treat everybody already wants.</p>
      <p>If your activity is at a meetinghouse, the building&rsquo;s rules come first, so ask your bishopric or building representative before you book. A covered tab with no sales is usually the simplest fit. If the building isn&rsquo;t an option, a park pavilion, a school lot or a member&rsquo;s driveway works just as well.</p>
      <h2 class="h2">An activity menu a bishopric can approve</h2>
      <p>We&rsquo;ll put together a short, family-friendly menu that a bishopric, a Young Women or Young Men presidency, or an activities committee can sign off on quickly. It can be fully caffeine-free: lemonades, Italian sodas, caffeine-free soda bases and soft-serve cones. Zero-sugar versions and kid sizes come standard. Set a budget and we&rsquo;ll cap the tab at it, so the ward clerk knows the number before the night starts.</p>
      <h2 class="h2">Schools across Washington County</h2>
      <p>PTA carnivals, back-to-school nights, teacher appreciation week, senior nights, and band, choir and drill banquets. PTAs, PTOs and booster clubs can book us at any school in the county, from Desert Hills, Snow Canyon, Pine View, Dixie and Crimson Cliffs to Hurricane, plus the elementary and middle schools that feed them. Schools and the district set their own rules for vendors on campus, so tell us what yours needs and we&rsquo;ll work through it before we quote.</p>
      <p>Few things say thank you to a southern Utah teacher like a dirty soda on a Friday afternoon. Pick the morning or the afternoon, we park at the school and pour for the staff, and the PTA covers the tab. Need an invoice or a purchase order? Ask in the notes.</p>
      <h2 class="h2">Farewells and homecomings</h2>
      <p>A missionary farewell or homecoming open house brings out the whole ward, the cousins and the high school friends, usually all at once. Park the trailer in the driveway and the line becomes part of the party. We can name a drink after the missionary or the mission, keep the menu short so the line moves while the family greets people at the door, and put everyone on one tab so nobody has to dig for a wallet.</p>
      <h2 class="h2">Utah Tech students and student wards</h2>
      <p>On campus, food and drink usually go through the university&rsquo;s own dining and event services, so check with them first for anything held at Utah Tech. Off campus, student wards, clubs, intramural teams and apartment complexes book us directly for socials, back-to-school nights and finals-week study breaks.</p>
      <h2 class="h2">Fundraisers</h2>
      <p>Raising money for a class trip, a youth trek, a team or a cause? Ask about a fundraiser stop: we park at your event, guests buy their own drinks, and part of the sales goes back to your group. Fundraisers where guests pay work best at a school, a park or a business lot. Put &ldquo;fundraiser&rdquo; in the form and we&rsquo;ll send the details. More about the trailer and the rest of the county on <a href="/dirty-soda-st-george">dirty soda in St. George</a>.</p>
    </div>
  </div>
</section>
{pkgs('Packages for groups', 'Sip &amp; Go is plenty for most teacher treats and youth nights. Carnivals and ward parties usually go with Full Beach so the soft serve can feed the line.')}
<section class="band"><div class="wrap"><p class="eyebrow">More in St. George</p><h2 class="h2">Planning something else?</h2><div class="cards cards--links cards--3">{sg_more_events('/'+slug)}</div></div></section>
{SG_AREA}'''
    fq = [
        ('Can we leave caffeine off the menu?', 'Yes. Tell us in the form and we&rsquo;ll build a caffeine-free menu from lemonades, Italian sodas, caffeine-free soda bases and soft serve.'),
        ('Can you come to an activity at the church building?', 'Ask your bishopric or building representative about the meetinghouse rules first. A covered tab with no sales is usually the simplest fit. If the building isn&rsquo;t an option, a park pavilion or a member&rsquo;s home works well.'),
        ('Can the ward, school or PTA pay by invoice?', 'Ask in the notes and we&rsquo;ll work out what your ward, school or organization needs when we send the quote.'),
        ('Do you do fundraisers?', 'Yes. Guests buy their own drinks and part of the sales goes back to your group. Fundraisers work best at a school, a park or a business lot. Mention it in the form and we&rsquo;ll share how it works.'),
        ('Can you serve at Utah Tech?', 'On campus, check with the university&rsquo;s dining and event services first, since they usually handle food and drink there. Off campus, student wards, clubs and apartment complexes can book us directly.'),
        ('Do you have kid sizes?', 'Yes. The Beach Babies menu is sized and priced for kids, and soft-serve cones are always a hit at Primary and youth activities.'),
    ]
    page(slug, 'St. George Church and School Dirty Soda | Thirsty Beaches',
         'Family-friendly dirty soda trailer for St. George ward parties, missionary homecomings, PTA nights and teacher thank-yous, with caffeine-free menus.',
         'Dirty soda for St. George church and school events',
         'Ward parties, youth nights, missionary homecomings, PTA nights and teacher thank-yous across Washington County. A family-friendly trailer with caffeine-free menus, kid sizes and real soft serve.',
         TSG + [('Church &amp; school events', '/' + slug)], sec, fq, 'Church or ward event', 'Dirty soda for church and school events in St. George', 'Event catering',
         extra_trust='<li>Caffeine-free menus</li>', region='stgeorge')

    # ── St. George event pages, round two (2026-11-17): company, graduation/birthday, HOA/neighborhood ──
    # Same rules. Local facts: St. George special event permit page (sgcity.org/specialevent), Tech Ridge (TechBuzz),
    # SkyWest HQ (Wikipedia), WCSD high schools (Wikipedia), SunRiver (sunriverstgeorge.com), Desert Color (desertcolor.com),
    # Green Valley (wchsutah.org). No insurance or certificate promises until Nick confirms the policy.
    CITY_PERMIT = ('A party that spills into a public street or uses a city park beyond a normal reservation can need a St. George '
                   'special event permit, and the city asks for those applications at least 45 days ahead; park reservations go '
                   'through City Parks. Washington City, Santa Clara, Ivins and Hurricane have their own rules.')

    slug = 'st-george-company-party'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Company parties</p>
    <h2 class="h2">The office soda run, for the whole team at once</h2>
    <div class="about">
      <p>In St. George the afternoon soda run is practically a workplace tradition: somebody takes a list, drives to a drive-thru and comes back with a tray of drinks that are already watering down. A drink trailer does it the other way around. We park in your lot, everyone walks out and orders their own, built to order over nugget ice, and the whole team takes a break together. In the town where Utah&rsquo;s best-known chain started, a dirty soda is the thank-you people actually want.</p>
      <p>We add the two things a drive-thru can&rsquo;t: real soft serve, so any soda can become a float, and espresso pulled to order for iced lattes and sweet-cream cold brew. Zero-sugar sodas, caffeine-free lemonades and Italian sodas cover the people who are counting.</p>
      <h2 class="h2">Built for the way St. George works</h2>
      <p>A lot of St. George doesn&rsquo;t work nine to five. Hospital and clinic teams run around the clock, the school district and the university have their own calendars, an airline is headquartered here, and tech companies have moved into Tech Ridge, on the site of the old municipal airport. Add dealerships, builders and construction crews, resorts, hotels and shops. Every one of them has an employee appreciation week, a goal that got hit, or a summer party that needs something better than a sheet cake.</p>
      <h2 class="h2">Shift changes and night crews</h2>
      <p>For teams that work around the clock, one visit can catch two shifts. We can open early with espresso and cold brew for the crew coming off nights, then pour sodas and floats for the day shift, or split the visit into two windows on the same day so nobody gets left out. Tell us your shift times in the form and we&rsquo;ll plan around them. Hospitals, plants and other secure sites usually have their own rules about where a vendor can park; we&rsquo;ll follow whatever your facilities team sets.</p>
      <h2 class="h2">Customer appreciation and open houses</h2>
      <p>Grand openings, model-home weekends, dealership sales events, client open houses and customer appreciation days all draw a crowd that lingers if there&rsquo;s something cold in hand. The company can cover every drink, cover the first round, or let guests buy their own. You&rsquo;ll need the property owner&rsquo;s OK for the spot. {CITY_PERMIT}</p>
      <h2 class="h2">Conventions, expos and team weekends</h2>
      <p>Conferences, expos and company retreats come with rules of their own. Convention centers and resorts often run their own food and drinks, so we check the venue&rsquo;s rules first; if outside vendors are allowed, we&rsquo;ll work with the event team on load-in and parking. A booth crew, a team tent or an after-party at a rental house nearby is usually simpler.</p>
      <h2 class="h2">Put your brand on it</h2>
      <p>We&rsquo;ll name a custom drink after your company, your product or your team and match it to your colors. Keep the menu to a short list so a big crowd moves quickly. Need an invoice or a purchase order? Ask in the notes and we&rsquo;ll set up billing your company can work with when we send the quote. More on <a href="/st-george-hoa-neighborhood-party">community events</a>, <a href="/st-george-tournaments-team-parties">team sponsorship nights</a> and <a href="/dirty-soda-st-george">dirty soda in St. George</a>.</p>
    </div>
  </div>
</section>
{pkgs('Packages for teams', 'Sip &amp; Go covers most office afternoons and shift treats. Customer events and summer parties usually go Full Beach or Endless Summer.')}
<section class="band"><div class="wrap"><p class="eyebrow">More in St. George</p><h2 class="h2">Planning something else?</h2><div class="cards cards--links cards--3">{sg_more_events('/'+slug)}</div></div></section>
{SG_AREA}'''
    fq = [
        ('Can the company cover everyone&rsquo;s drinks?', 'Yes. Cover the whole team, set a cap, or switch to guests paying once the tab runs out. Tell us which you want in the form.'),
        ('Can you visit twice in one day for different shifts?', 'Often, yes. Put your shift times in the notes and we&rsquo;ll quote one longer window or two shorter ones, so the night crew and the day crew both get a drink.'),
        ('Can you send an invoice?', 'Mention it in the notes and we&rsquo;ll set up billing your company can work with, including a purchase order if you need one, when we send the quote.'),
        ('Do you do morning events?', 'Yes. We pull espresso to order, so iced lattes and sweet-cream cold brew are ready for a morning all-hands, an open house or a client breakfast.'),
        ('What do you need at our building?', 'A flat spot a truck and trailer can pull into, close to the door, and the property owner&rsquo;s OK. The trailer runs on its own generator and carries its own water. If your facility has vendor rules, tell us and we&rsquo;ll follow them.'),
        ('Can we name a drink after our company?', 'Yes. We&rsquo;ll build a custom drink in your colors and name it for your company, product or team.'),
    ]
    page(slug, 'St. George Company Party Dirty Soda Bar | Thirsty Beaches',
         'A dirty soda, soft-serve and espresso trailer for St. George employee appreciation days, shift-change treats, open houses and summer company parties.',
         'Dirty soda for St. George company parties',
         'Employee appreciation, shift-change treats, customer open houses and summer parties across Washington County. A retro trailer pouring dirty sodas, soft serve and espresso, with the tab handled however you want.',
         TSG + [('Company parties', '/' + slug)], sec, fq, 'Company party', 'Dirty soda for company parties in St. George', 'Corporate catering',
         extra_trust='<li>Custom company drink</li>', region='stgeorge')

    slug = 'st-george-graduation-birthday-party'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Graduations &amp; birthdays</p>
    <h2 class="h2">Graduation open houses, the southern Utah way</h2>
    <div class="about">
      <p>Graduation in Washington County usually means an open house: the grad in the driveway, a slideshow on the garage door, and the ward, the cousins and the whole team dropping by over a couple of hours. That drop-in rhythm is exactly what a drink trailer is good at. Guests walk up, order a drink their way, and stay to talk instead of grabbing a can and leaving. We do open houses for graduates from Desert Hills, Dixie, Pine View, Snow Canyon, Crimson Cliffs, Hurricane and the other high schools across the county, plus college grads from Utah Tech and Dixie Technical College.</p>
      <p>We&rsquo;ll name a drink after the graduate and match the syrups to the school colors, and keep the menu short so the line moves when the crowd arrives all at once. Graduation open houses tend to land on the same few weekends, so book as early as you can.</p>
      <h2 class="h2">Birthdays for every age</h2>
      <p>Kids&rsquo; birthdays are the easy ones: Beach Babies kid sizes, soft-serve cones and anything blue. Sweet sixteens and eighteenths get the full board and a drink named for the birthday. Then there are the milestone birthdays: a fiftieth with the neighbors, an eightieth with four generations in the backyard, a surprise party at a rental house. The grandparents can have a caffeine-free lemonade or a Diet Coke with coconut, and the toddlers get a cone.</p>
      <h2 class="h2">Family milestones</h2>
      <p>The parties St. George families throw don&rsquo;t stop at birthdays. Baptism-day lunches, baby showers, anniversaries, retirement parties, family reunions, and the missionary farewells and homecomings that bring the whole family to one backyard (see <a href="/st-george-church-school-events">church and school events</a>). Bridal showers and receptions have their own page: <a href="/st-george-wedding-soda-bar">southern Utah weddings</a>.</p>
      <h2 class="h2">Where the trailer parks</h2>
      <p>Most of these parties happen at home, and that is the easiest setup. We need a flat spot that a truck and trailer can pull into, like a driveway, a side yard or the curb out front, close enough to your guests that the line feels like part of the party. The trailer runs on its own generator and carries its own water. If your neighborhood has an HOA, check its rules on vendors and street parking. {CITY_PERMIT} More on <a href="/st-george-hoa-neighborhood-party">HOA and neighborhood parties</a>.</p>
      <h2 class="h2">How the tab works</h2>
      <p>Most families cover everyone. You can also set a cap, cover the first drink, or let guests buy their own after that. Tell us the head count and how long the open house runs, and we&rsquo;ll suggest the right package and a menu that fits your crowd. More about the trailer on <a href="/dirty-soda-st-george">dirty soda in St. George</a>.</p>
      <h2 class="h2">Open houses in the heat</h2>
      <p>Graduation and summer birthdays land in the hottest part of the year, when afternoons regularly pass 100 degrees. Evening open houses work best, after the sun drops. Every drink is poured over nugget ice, and a soft-serve float is hard to beat on a hot night. For a midday party we&rsquo;ll suggest a short menu and a shaded spot for the line.</p>
    </div>
  </div>
</section>
{pkgs('Party packages', 'Sip &amp; Go is plenty for most birthdays. Graduation open houses with a big drop-in crowd usually go Full Beach so the soft serve can feed the line.')}
<section class="band"><div class="wrap"><p class="eyebrow">More in St. George</p><h2 class="h2">Planning something else?</h2><div class="cards cards--links cards--3">{sg_more_events('/'+slug)}</div></div></section>
{SG_AREA}'''
    fq = [
        ('Can you come to a graduation open house?', 'Yes. Open houses are one of the parties we built the trailer for. Send the date, the address area, the head count and how long the open house runs, and we&rsquo;ll reply with a price within one business day.'),
        ('How far ahead should we book for graduation?', 'As early as you can, since graduation open houses tend to land on the same few weekends. For a birthday or a weeknight party, ask anyway: if the trailer is free, we&rsquo;ll come.'),
        ('Do you have kid sizes for a kids&rsquo; birthday?', 'Yes. The Beach Babies menu is sized and priced for kids, and soft-serve cones are always a hit. Caffeine-free drinks are easy too.'),
        ('Can you set up at a city park?', 'Often, with a park reservation, and the city&rsquo;s rules come first. Anything beyond a normal reservation can need a St. George special event permit, applied for at least 45 days ahead. A home is the simplest setup.'),
        ('Can guests pay for their own drinks?', 'Yes. Most families cover everyone, but you can set a cap or cover the first drink and let guests buy their own after that.'),
        ('Can you name a drink after the graduate?', 'Yes. We&rsquo;ll build a signature drink, match it to the school colors and put the graduate&rsquo;s name on it for the day.'),
    ]
    page(slug, 'St. George Graduation, Birthday Soda Bar | Thirsty Beaches',
         "A dirty soda and soft-serve trailer for St. George graduation open houses, kids' birthdays, milestone parties and family reunions. Booking now.",
         'Dirty soda for St. George graduation and birthday parties',
         'Graduation open houses, kids&rsquo; birthdays, milestone parties and family reunions across Washington County. A retro trailer with dirty sodas, soft-serve floats and espresso, and a drink named for the guest of honor.',
         TSG + [('Graduations &amp; birthdays', '/' + slug)], sec, fq, 'Birthday or graduation', 'Dirty soda for graduation and birthday parties in St. George', 'Party catering',
         extra_trust='<li>Drink named for the guest of honor</li>', region='stgeorge')

    slug = 'st-george-hoa-neighborhood-party'
    sec = f'''
<section class="band">
  <div class="wrap">
    <p class="eyebrow">HOA &amp; neighborhood parties</p>
    <h2 class="h2">A town of neighborhoods with a social calendar</h2>
    <div class="about">
      <p>A lot of St. George lives in neighborhoods with an HOA, a clubhouse and a calendar to fill: pool openings, movie nights, holiday parties, back-to-school bashes and welcome parties for the new move-ins. That is an old tradition here. When The Park at Green Valley opened, it came with an owners association, a clubhouse and a pool, which the Washington County Historical Society counts among the firsts for St. George. Today Desert Color runs summer kickoffs with food trucks and dive-in movie nights, and neighborhoods like Kayenta have homeowners associations of their own.</p>
      <p>A drink trailer is the easiest crowd-pleaser on that calendar. We park at the clubhouse lot or the common area, pour every drink to order over nugget ice, and the whole street gets a drink built the way they like it. Real soft serve turns any soda into a float, and the kids get Beach Babies sizes and cones.</p>
      <h2 class="h2">55+ communities and clubhouse socials</h2>
      <p>St. George&rsquo;s active-adult communities run some of the busiest social calendars in town. SunRiver, the first 55+ community in southern Utah, has a community center of more than 35,000 square feet with a ballroom, over 70 clubs and groups, and its own poolside caf&eacute;, so the association sets the rules for vendors on its grounds, and a club or committee would go through it first. Desert Color has a 55+ neighborhood too. For an afternoon social, a club party or a street get-together with the association&rsquo;s OK, we bring zero-sugar sodas, caffeine-free lemonades and Italian sodas, and floats that remind everybody of the soda fountain they grew up with.</p>
      <h2 class="h2">How HOA billing works</h2>
      <p>The HOA can cover everyone, set a cap, or let residents buy their own. A pop-up where neighbors pay costs the HOA nothing. One quote, one invoice if you need it, and a clear price your board can approve. Tell us what your HOA or management company requires from vendors and we&rsquo;ll confirm we can meet it before we quote.</p>
      <h2 class="h2">Clubhouse lot, common area or the street?</h2>
      <p>A clubhouse parking lot or a common area the HOA controls is the simplest spot: you approve it, and we need a flat place a truck and trailer can pull into, close to your guests. The trailer runs on its own generator and carries its own water, so no hookup is needed. {CITY_PERMIT}</p>
      <h2 class="h2">Apartments and townhome communities</h2>
      <p>Resident appreciation nights, pool-season kickoffs, move-in welcome events and leasing open houses work the same way, with the property manager covering the tab or residents buying their own. We follow your community&rsquo;s rules on where to park and when to load in.</p>
      <h2 class="h2">Neighborhood pages</h2>
      <p>See the page for your part of town: <a href="/dirty-soda-desert-color">Desert Color</a>, <a href="/dirty-soda-bloomington-green-valley">Bloomington and Green Valley</a>, <a href="/dirty-soda-washington-city">Washington City</a> and Coral Canyon, <a href="/dirty-soda-santa-clara">Santa Clara</a>, <a href="/dirty-soda-ivins">Ivins</a> and Kayenta, and <a href="/dirty-soda-hurricane-sand-hollow">Hurricane</a>. Throwing a birthday or a graduation open house for your own family? See <a href="/st-george-graduation-birthday-party">graduations and birthdays</a>, or start at <a href="/dirty-soda-st-george">dirty soda in St. George</a>.</p>
    </div>
  </div>
</section>
{pkgs('Packages for neighborhoods', 'Sip &amp; Go works for a small clubhouse social. Pool openings and block parties usually go Full Beach, or a pop-up where neighbors buy their own.')}
<section class="band"><div class="wrap"><p class="eyebrow">More in St. George</p><h2 class="h2">Planning something else?</h2><div class="cards cards--links cards--3">{sg_more_events('/'+slug)}</div></div></section>
{SG_AREA}'''
    fq = [
        ('Can the HOA cover everyone&rsquo;s drinks?', 'Yes. The HOA can cover everyone, set a cap, or let residents buy their own once the tab runs out. A pop-up where neighbors pay costs the HOA nothing.'),
        ('Do we need a permit for a block party?', 'If the party stays on HOA common area or private property, your HOA&rsquo;s rules apply. A party in a public street or a city park beyond a normal reservation can need a St. George special event permit, applied for at least 45 days ahead. Other cities have their own rules.'),
        ('Can you come to a 55+ community?', 'Yes, with the association&rsquo;s OK. Many active-adult communities have their own caf&eacute; or vendor rules, so a club or committee usually books through the association first.'),
        ('What do you need from the HOA?', 'A flat spot a truck and trailer can pull into, like a clubhouse lot, and the HOA&rsquo;s OK. Tell us what your HOA or management company requires from vendors and we&rsquo;ll confirm we can meet it before we quote.'),
        ('Do you do apartment resident events?', 'Yes. Resident appreciation nights, pool kickoffs and leasing open houses. The property manager covers the tab or residents buy their own.'),
        ('Do you have zero-sugar and caffeine-free drinks?', 'Yes. Most sodas come in a zero-sugar version, lemonades and Italian sodas have no caffeine, and kid sizes and soft-serve cones cover the youngest neighbors.'),
    ]
    page(slug, 'St. George HOA and Block Party Soda Bar | Thirsty Beaches',
         'A dirty soda and soft-serve trailer for St. George HOA socials, block parties, pool openings, 55+ clubhouse nights and apartment resident events.',
         'Dirty soda for St. George HOA and neighborhood parties',
         'Pool openings, block parties, clubhouse socials and 55+ community nights across Washington County. A retro trailer with dirty sodas, soft-serve floats and espresso, and the tab handled however your HOA wants.',
         TSG + [('HOA &amp; neighborhood parties', '/' + slug)], sec, fq, 'HOA or neighborhood party', 'Dirty soda for HOA and neighborhood parties in St. George', 'Event catering',
         extra_trust='<li>Own power &amp; water</li>', region='stgeorge')

    # ── Florida hub ──
    FL_AREA = """
<section class="band" id="area">
  <div class="wrap">
    <p class="eyebrow">Service area</p>
    <h2 class="h2">Tampa Bay to Naples</h2>
    <p class="lede">The trailer works Florida&rsquo;s Gulf Coast, from Tampa, St. Pete and Clearwater down through Bradenton, Sarasota and Venice to Fort Myers and Naples. Somewhere else in Florida? Ask, and we&rsquo;ll quote the drive.</p>
    <div class="chips" style="justify-content:flex-start">
      <a class="chip" href="/dirty-soda-tampa-bay">Tampa Bay</a><a class="chip" href="/dirty-soda-tampa-bay">St. Pete &amp; Clearwater</a><span class="chip">Bradenton</span><a class="chip" href="/dirty-soda-sarasota">Sarasota</a><span class="chip">Venice</span><span class="chip">Fort Myers</span><a class="chip" href="/dirty-soda-naples">Naples</a>
    </div>
  </div>
</section>
"""
    fl_sections = f"""
<section class="band">
  <div class="wrap">
    <p class="eyebrow">What shows up</p>
    <h2 class="h2">A Utah soda shop, parked on the Gulf Coast</h2>
    <div class="about">
      <p>Dirty soda is Utah&rsquo;s drink: fountain soda over nugget ice, real syrups and fruit pur&eacute;es, and a pour of cream, every drink built to order. Thirsty Beaches brings it to Florida in a retro trailer, then adds the two things that matter in Gulf Coast heat. We run real soft serve, so any soda can turn into a float, and we pull fresh espresso for iced lattes and sweet-cream cold brew.</p>
      <p>Most Florida crowds haven&rsquo;t had a dirty soda yet, so the trailer gets noticed. Pick a short list of easy wins like the Thirst Trap (Dr Pepper, coconut, sweet cream) or a pineapple-coconut Sprite, or run the full board. Zero-sugar versions, caffeine-free lemonades and Italian sodas, and kid sizes cover everyone from the grandparents to the toddlers.</p>
    </div>
  </div>
</section>
{pkgs()}
<section class="band">
  <div class="wrap">
    <p class="eyebrow">Events we do</p>
    <h2 class="h2">Built for Gulf Coast parties</h2>
    <div class="cards cards--links">
      <a class="card" href="?event=wedding#quote"><span class="card__tag">Weddings</span><h3>Receptions &amp; showers</h3><p>Beach-town receptions, rehearsal dinners and showers, with a signature drink named for the couple</p></a>
      <a class="card" href="?event=school#quote"><span class="card__tag">Groups</span><h3>Schools, churches &amp; fundraisers</h3><p>PTA nights, youth events, teacher thank-yous; caffeine-free on request</p></a>
      <a class="card" href="?event=company#quote"><span class="card__tag">Work</span><h3>Company parties</h3><p>Office treat days, open houses, client events</p></a>
      <a class="card" href="?event=hoa#quote"><span class="card__tag">Community</span><h3>HOA &amp; condo socials</h3><p>Pool parties, clubhouse nights and neighborhood events</p></a>
      <a class="card" href="?event=birthday#quote"><span class="card__tag">Also</span><h3>Birthdays &amp; graduations</h3><p>Backyard parties, sweet sixteens and grad parties</p></a>
      <a class="card" href="?event=market#quote"><span class="card__tag">Also</span><h3>Markets &amp; festivals</h3><p>Pop-up stops where guests buy their own drinks</p></a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <p class="eyebrow">How it works</p>
    <h2 class="h2">Three steps to a dirty soda bar</h2>
    <div class="steps">
      <div class="step"><h3>Send the basics</h3><p>Date, place, head count. Takes a minute with the form below.</p></div>
      <div class="step"><h3>Get your quote</h3><p>Within one business day: availability, a price and a suggested menu for your crowd.</p></div>
      <div class="step"><h3>We roll up</h3><p>We arrive early, set up and pour. You enjoy your event, then we pack out and leave the spot clean.</p></div>
    </div>
  </div>
</section>
{FL_AREA}"""
    fl_faq = [
        ('What is a dirty soda?', 'A fountain soda, like Dr Pepper, Coke or Sprite, mixed with flavored syrups or fruit pur&eacute;e and topped with a splash of cream. It started in Utah drive-thrus. See the full <a href="/menu">menu</a>.'),
        ('How far ahead should I book?', 'For weddings and busy winter-season weekends, a month or more out is ideal. For smaller events, ask anyway: if the trailer is free, we&rsquo;ll come.'),
        ('Is this a soda truck I can rent for a party?', 'Pretty much. It&rsquo;s a retro soda trailer we tow to your event and run ourselves, so you get a full mobile soda bar with staff, not an empty truck. Birthday parties, HOA socials, weddings and company events all work, from Tampa Bay to Naples.'),
        ('How much does it cost?', 'It depends on guest count, hours and what you add (soft serve, espresso). Send the form and you&rsquo;ll get an exact price within one business day, with no deposit needed to ask.'),
        ('Can you set up at the beach?', 'The trailer needs a flat, firm spot it can be driven to, like a parking lot, driveway, lawn edge or venue pad, so we usually set up at the venue or the closest lot to the sand. Tell us the spot and we&rsquo;ll work out the best setup when we quote.'),
        ('Can guests pay for their own drinks?', 'Yes. You can cover everyone, open a tab up to a set amount, or have us run a pop-up where guests buy their own. That last one works well for markets, HOA events and fundraisers.'),
        ('Do you have options for kids and people avoiding sugar or caffeine?', 'Yes. Most sodas come in a zero-sugar version, lemonades and Italian sodas have no caffeine, and our Beach Babies sizes are made for kids.'),
        ('Do you do events in Utah too?', 'Yes. The trailer opens first in <a href="/dirty-soda-st-george">St. George</a> and also works Utah&rsquo;s Wasatch Front: see <a href="/utah-dirty-soda-catering">Utah catering</a>.'),
    ]
    page(FL_HUB, 'Dirty Soda Catering in Florida | Thirsty Beaches',
         'Dirty soda bar and soft-serve trailer for Gulf Coast weddings, school, HOA and company events, Tampa Bay to Naples. Quote in 1 business day.',
         'Dirty soda catering on Florida&rsquo;s Gulf Coast',
         'Our retro trailer brings Utah-style dirty sodas, real soft serve and fresh espresso to weddings, school nights, HOA socials and company events from Tampa Bay to Naples. Tell us the date and we&rsquo;ll send a price within one business day.',
         [('Thirsty Beaches', '/'), ('Florida catering', FL_HUB_URL)], fl_sections, fl_faq, None,
         'Dirty soda trailer catering', 'Event catering', region='florida', extra_trust='<li>Tampa Bay &middot; Sarasota &middot; Naples</li>')

if __name__ == '__main__':
    build()
