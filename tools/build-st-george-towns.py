#!/usr/bin/env python3
"""Builds the Washington County town pages (same layout as site/dirty-soda-st-george.html).

  python3 tools/build-st-george-towns.py      then   python3 tools/build-agent-files.py

Pages (2026-11-17): /dirty-soda-washington-city, /dirty-soda-santa-clara, /dirty-soda-ivins, /dirty-soda-hurricane-sand-hollow,
/dirty-soda-laverkin-toquerville-leeds, and the St. George neighborhood pages /dirty-soda-desert-color and
/dirty-soda-bloomington-green-valley. The old /dirty-soda-ivins-santa-clara page was split in two (301 in site/_redirects).
Local facts come from sources opened on 2026-11-16/17 (see tools/seo/query-map-st-george.md); don't add local claims without one.
Rules for the copy (St. George launch, 2026-11-16): no event dates, no "we'll be at X", no competitor claims
(Swig only as "Utah's best-known chain started here"), venues and parks set their own vendor rules.
Schema: FoodEstablishment (shared @id, areaServed only: no street address until the trailer is based in
St. George, no opening hours until public stops are real) + BreadcrumbList + FAQPage built from the visible FAQ.
"""
import html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
BASE = 'https://thirstybeaches.com'
CSS_V = 'ux20261025'
OG = BASE + '/assets/og.jpg?v=logo20261018'
FONT = 'https://fonts.googleapis.com/css2?family=Bungee&family=Archivo:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap'
# Social profiles for schema sameAs. The Instagram/TikTok handles are the Florida ones (_fl / florida), so they are left
# off the St. George pages until Nick has Utah or neutral handles. Add them here (and to the footer partial) when ready.
SAME_AS = ['https://www.facebook.com/people/Thirsty-Beaches/100077594055245/']
UTAH = {'@type': 'State', 'name': 'Utah'}
AREA_SERVED = [{'@type': 'City', 'name': 'St. George', 'containedInPlace': UTAH},
               {'@type': 'City', 'name': 'Washington', 'alternateName': 'Washington City', 'containedInPlace': UTAH},
               {'@type': 'City', 'name': 'Ivins', 'containedInPlace': UTAH},
               {'@type': 'City', 'name': 'Santa Clara', 'containedInPlace': UTAH},
               {'@type': 'City', 'name': 'Hurricane', 'containedInPlace': UTAH},
               {'@type': 'AdministrativeArea', 'name': 'Washington County', 'containedInPlace': UTAH}]
TOWNS = [('/dirty-soda-st-george', 'St. George'), ('/dirty-soda-desert-color', 'Desert Color'),
         ('/dirty-soda-bloomington-green-valley', 'Bloomington &amp; Green Valley'), ('/dirty-soda-washington-city', 'Washington City'),
         ('/dirty-soda-santa-clara', 'Santa Clara'), ('/dirty-soda-ivins', 'Ivins'), ('/dirty-soda-hurricane-sand-hollow', 'Hurricane &amp; Sand Hollow'),
         ('/dirty-soda-laverkin-toquerville-leeds', 'LaVerkin, Toquerville &amp; Leeds')]
EVENTS = [('/st-george-wedding-soda-bar', 'Weddings', 'Receptions &amp; open houses', 'Southern Utah receptions, showers and luncheons'),
          ('/st-george-graduation-birthday-party', 'Parties', 'Graduations &amp; birthdays', 'Open houses, kids&#39; birthdays, milestone parties'),
          ('/st-george-hoa-neighborhood-party', 'Neighbors', 'HOA &amp; neighborhood parties', 'Pool days, block parties, 55+ socials'),
          ('/st-george-church-school-events', 'Groups', 'Church &amp; school events', 'Ward parties, homecomings, PTA nights'),
          ('/st-george-tournaments-team-parties', 'Teams', 'Tournaments &amp; team parties', 'Tournament weekends, season-end parties, boosters'),
          ('/st-george-company-party', 'Work', 'Company parties', 'Employee thank-yous, shift treats, open houses')]
LAVERKIN, TOQUERVILLE, LEEDS = ({'@type': 'City', 'name': n, 'containedInPlace': UTAH} for n in ('LaVerkin', 'Toquerville', 'Leeds'))

esc = lambda s: html.escape(s, quote=True)
text = lambda s: re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html.unescape(s))).strip()


def build(p):
    slug, url = p['slug'], f"{BASE}/{p['slug']}"
    quote = f"/utah-dirty-soda-catering?city={p['city_q']}#quote"
    biz = {'@context': 'https://schema.org', '@type': 'FoodEstablishment', '@id': BASE + '/#business', 'name': 'Thirsty Beaches',
           'url': BASE + '/', 'mainEntityOfPage': url, 'image': OG, 'description': p['schema_desc'],
           'servesCuisine': ['Dirty soda', 'Soft serve', 'Espresso'], 'priceRange': '$', 'hasMenu': BASE + '/menu',
           'email': 'hello@thirstybeaches.com', 'areaServed': AREA_SERVED + p.get('extra_area', []), 'sameAs': SAME_AS}
    crumbs = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Thirsty Beaches', 'item': BASE + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'St. George', 'item': BASE + '/dirty-soda-st-george'},
        {'@type': 'ListItem', 'position': 3, 'name': text(p['crumb']), 'item': url}]}
    faq_ld = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': text(q), 'acceptedAnswer': {'@type': 'Answer', 'text': text(a)}} for q, a in p['faq']]}
    ld = ''.join(f'<script type="application/ld+json">{json.dumps(s, ensure_ascii=False)}</script>\n' for s in (biz, crumbs, faq_ld))
    chips = ''.join(f'<span class="chip" aria-current="page">{n}</span>' if u == '/' + slug else f'<a class="chip" href="{u}">{n}</a>' for u, n in TOWNS)
    chips += ''.join(f'<span class="chip">{c}</span>' for c in p['chips']) + '<a class="chip" href="/utah-dirty-soda-catering">All of Utah</a>'
    cards = ''.join(f'<a class="card" href="{u}"><span class="card__tag">{t}</span><h3>{h}</h3><p>{d}</p></a>' for u, t, h, d in EVENTS)
    body = ''.join(f'\n      <h2 class="h2">{h}</h2>\n      <p>{t}</p>' for h, t in p['sections'])
    faq = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in p['faq'])
    foot = (ROOT / 'tools' / 'partials' / 'footer.html').read_text().strip()
    out = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Generated by tools/build-st-george-towns.py: edit the script, not this file -->
<title>{esc(p['title'])}</title>
<meta name="description" content="{esc(p['desc'])}">
<meta name="theme-color" content="#08011C">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/icon-192.png?v=logo20261018">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
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
<meta property="og:title" content="{esc(p['title'])}">
<meta property="og:description" content="{esc(p['desc'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{OG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Thirsty Beaches neon logo: a cup with a straw, palm trees and a wave, with the Stay Thirsty, Beaches tagline.">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(p['title'])}">
<meta name="twitter:description" content="{esc(p['desc'])}">
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
    <a class="nav__book" href="/utah-dirty-soda-catering">Book</a>
  </div>
</nav>

<main id="main">
<section class="band band--glow">
  <div class="wrap">
    <p class="crumbs"><a href="/">Thirsty Beaches</a> &middot; <a href="/dirty-soda-st-george">St. George</a> &middot; {p['crumb']}</p>
    <p class="soon">Opening soon &middot; Booking {p['soon']} events now</p>
    <h1 class="h2">{p['h1']}</h1>
    <p class="lede">{p['lede']}</p>
    <div class="actions" style="justify-content:flex-start;margin-top:1.6rem">
      <a class="btn btn--solid" href="{quote}">{p['cta']}</a>
      <a class="btn btn--ghost" href="/menu">See the Menu</a>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="about">{body}
    </div>

    <p class="eyebrow" style="margin-top:2.4rem">Around St. George</p>
    <div class="chips" style="justify-content:flex-start">
      {chips}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <p class="eyebrow">Plan an event</p>
    <h2 class="h2">{p['events_h']}</h2>
    <div class="cards cards--links cards--3">{cards}</div>
  </div>
</section>

<section class="band" id="faq">
  <div class="wrap">
    <p class="eyebrow">Questions</p>
    <h2 class="h2">{p['faq_h']}</h2>
    <div class="faq">{faq}</div>

    <div class="actions" style="justify-content:flex-start;margin-top:2.4rem">
      <a class="btn btn--solid" href="{quote}">Book an Event</a>
      <a class="btn btn--ghost" href="/menu">See the Menu</a>
      <a class="btn btn--ghost" href="/#stops">See Stops</a>
    </div>
  </div>
</section>
</main>

{foot}

<button class="fxbtn" id="vhsBtn" type="button" aria-pressed="false">VHS mode</button>
<script src="/app.js?v={CSS_V}" defer></script>
<script src="/sw-register.js" defer></script>
</body>
</html>
'''
    path = SITE / f'{slug}.html'
    # keep the Markdown alternate link that tools/build-agent-files.py adds to the head
    if path.exists():
        m = re.search(r'<link rel="alternate" type="text/markdown" href="[^"]*">', path.read_text())
        if m: out = out.replace('</head>', m.group(0) + '\n</head>', 1)
    path.write_text(out)
    print('wrote', slug, len(out))


NOT_OPEN = ('We&#39;re not open for public stops yet, and we won&#39;t make up a date. Public stops go on the '
            '<a href="/#stops">homepage stops list</a> and the live map once they&#39;re actually booked, and text and email alerts are coming soon. ')

PAGES = [
{
 'slug': 'dirty-soda-washington-city', 'city_q': 'Washington%20City', 'soon': 'Washington City', 'crumb': 'Washington City',
 'title': 'Washington City Dirty Soda Trailer, UT | Thirsty Beaches',
 'desc': 'Dirty sodas, soft-serve floats and espresso from a retro trailer for Washington City and Coral Canyon parties, HOA socials and school nights.',
 'schema_desc': 'A retro dirty soda trailer opening first in St. George and booking events next door in Washington City, Utah: Coral Canyon, Green Springs, Sienna Hills and Washington Fields.',
 'h1': 'Dirty soda in Washington City, Utah',
 'lede': 'Washington City is right next door to St. George, where we open first. Dirty sodas built to order, real soft serve and fresh espresso for backyard parties, HOA socials and school nights, from Green Springs to Coral Canyon.',
 'cta': 'Book a Washington City Event',
 'sections': [
  ('Next door to where dirty soda started', 'Washington City sits just east of St. George along the Virgin River, and the soda habit here is as strong as anywhere in Washington County. Utah&#39;s best-known chain started here, a few miles down the road, and the drive-thru soda run is part of a lot of commutes. We&#39;re not a drive-thru. Thirsty Beaches is a retro trailer you book for your own event, and it pours for everyone at once. The Thirst Trap (Dr Pepper, coconut, sweet cream) is the classic, the board runs past a hundred drinks, and you can <a href="/#build">build your own</a> and show us the screen at the window.'),
  ('Neighborhood parties from Green Springs to Coral Canyon', 'A lot of Washington City is newer neighborhoods with an HOA calendar to fill: Coral Canyon out on the east end, Sienna Hills, Washington Fields, Green Springs, and the older streets around Telegraph and the historic downtown. Those are the parties we built the trailer for. A pool-deck social, a block party that deserves better than a cooler of cans, a back-to-school night for the street, a welcome party for the new move-ins. Tell us the head count and whether the HOA is covering the tab, we park on the street or in the clubhouse lot, and everyone gets a drink built the way they like it. Kid sizes and zero-sugar versions keep the whole street happy. More on <a href="/st-george-hoa-neighborhood-party">HOA and neighborhood parties</a>.'),
  ('Schools, wards and teams on the east side', 'Crimson Cliffs High School and the elementary and middle schools around it keep the PTA and booster calendar full. We do teacher appreciation days, PTA carnivals, senior nights and team fundraisers, with a caffeine-free menu whenever a school asks for one. Wards and stakes book us for youth nights, ward parties and missionary farewells and homecomings. If your activity is at a meetinghouse, the building&#39;s rules come first, so a covered tab with no sales is usually the simplest fit, or we can meet you at a park or a home. See <a href="/st-george-church-school-events">church and school events</a> and <a href="/st-george-tournaments-team-parties">tournaments and team parties</a>.'),
  ('Made for Washington County summers', 'Summer afternoons here regularly pass 100 degrees, and an outdoor party needs cold drinks that don&#39;t take forever. Every drink is poured over nugget ice, the soft-serve machine turns any soda into a float, and cones and shakes cover anyone skipping the soda. For a midday summer event we&#39;ll suggest a short menu and a morning or evening window so nobody waits in the sun. Spring and fall evenings are close to perfect for a backyard party, and that&#39;s when a lot of receptions and open houses happen out here. Planning one? See <a href="/st-george-wedding-soda-bar">southern Utah weddings</a>.'),
  ('Markets, Cotton Days and community events', 'Washington City has deep roots. The old cotton factory still stands near the historic downtown, and it&#39;s why the town&#39;s community celebration is called Cotton Days. The Saturday farmers market at Veterans Park, the community center and the city parks all host events of their own. Organizing a booth, a vendor row or a community night? Ask about a pop-up where guests buy their own drinks. Events and venues set their own vendor rules and permits, so we&#39;ll check what yours needs before we quote, and a public stop only goes on our list once it&#39;s booked.'),
  ('On the way to Quail Creek and Sand Hollow', 'From Washington City it&#39;s a short drive to Quail Creek and Sand Hollow, and plenty of visiting families stay in rentals out this way. Family reunions, cousins in town for the week, a birthday at a rental with a pool: those make great private bookings. If your event is further east, see <a href="/dirty-soda-hurricane-sand-hollow">Hurricane and Sand Hollow</a>. Back across the river, <a href="/dirty-soda-st-george">St. George</a> is where the trailer opens first.'),
  ('Where you&#39;ll find us in Washington City', NOT_OPEN + f'Until then, the fastest way to get the trailer to Washington City is to <a href="/utah-dirty-soda-catering?city=Washington%20City#quote">book it for your own event</a>.'),
 ],
 'chips': ['Coral Canyon', 'Green Springs', 'Sienna Hills', 'Washington Fields'],
 'events_h': 'Washington City events we do',
 'faq_h': 'Washington City dirty soda FAQ',
 'faq': [
  ('Do you come to Washington City?', 'Yes. Washington City, Coral Canyon, Green Springs, Sienna Hills and Washington Fields are next door to St. George, where we open first. <a href="/utah-dirty-soda-catering?city=Washington%20City#quote">Send the date, place and head count</a> and we&#39;ll reply with a price within one business day.'),
  ('Can you do an HOA or neighborhood party?', 'Yes. The HOA can cover everyone, set a cap, or let neighbors buy their own. We need a flat spot that a truck and trailer can pull into, like a clubhouse lot or a quiet street.'),
  ('Do you do school and booster events in Washington City?', 'Yes, when the school, PTA or booster club books it. Schools set their own rules for vendors on campus, so we&#39;ll work through what yours needs. Caffeine-free menus and kid sizes are easy.'),
  ('Can you vend at a market or community event?', 'Often, if the organizer has room and approves us. Markets and city events set their own vendor rules and permits. We only list a public stop once it&#39;s booked.'),
  ('What do you serve?', 'Dirty sodas built to order, real soft serve (cones, cups, shakes and floats), fresh espresso, lemonades and Italian sodas, plus zero-sugar versions and Beach Babies kid sizes. See the <a href="/menu">menu</a>.'),
  ('When will the trailer be open?', 'We&#39;re not open for public stops yet, and we won&#39;t make up a date. Stops go on the homepage stops list and live map the minute they&#39;re booked. Private events are booking now.'),
 ],
},
{
 'slug': 'dirty-soda-hurricane-sand-hollow', 'city_q': 'Hurricane', 'soon': 'Hurricane', 'crumb': 'Hurricane &amp; Sand Hollow',
 'title': 'Hurricane and Sand Hollow Dirty Soda | Thirsty Beaches',
 'desc': 'A retro dirty soda and soft-serve trailer for Hurricane, LaVerkin and Sand Hollow parties, family reunions and group days on the road to Zion.',
 'schema_desc': 'A retro dirty soda trailer opening first in St. George and booking events in Hurricane, LaVerkin, Toquerville and the Sand Hollow area of Washington County, Utah.',
 'extra_area': [LAVERKIN, TOQUERVILLE],
 'h1': 'Dirty soda in Hurricane and Sand Hollow, Utah',
 'lede': 'Red sand, warm water and a long drive home. Dirty sodas built to order, real soft-serve floats and fresh espresso for Hurricane parties, Sand Hollow group days and family reunions on the road to Zion, from a retro trailer that comes to you.',
 'cta': 'Book a Hurricane Event',
 'sections': [
  ('The beach town of Washington County', 'Thirsty Beaches was built around one idea, bringing the beach to you, and Hurricane is the town in Washington County with a beach of its own. Sand Hollow&#39;s red-sand shoreline and warm water pull boats, paddleboards and side-by-sides all summer, and Quail Creek is just around the corner. A cold dirty soda or a soft-serve float after a day on the water is exactly the drink we built the trailer for. Utah&#39;s best-known chain started here in Washington County, so the soda habit runs deep; what we add is real soft serve and espresso, poured at your party.'),
  ('Sand Hollow and Quail Creek: plan it the right way', 'Utah State Parks require permission (a special use permit) for commercial vendors, so we don&#39;t just pull onto the beach and start selling. For a big group day at Sand Hollow, talk to us early and we&#39;ll work through what the park needs with you, or we&#39;ll meet your group at your rental, a home or a private lot close by. The resort and golf venues near the reservoir run their own food and drinks, so private events there go through the venue first.'),
  ('Hurricane, LaVerkin and Toquerville', 'Hurricane has grown fast, but it still has its old downtown along State Street and a harvest celebration, Peach Days, that goes back generations. Washington County Legacy Park hosts the county fair, rodeos and markets, and county and festival events usually run their own concessions or vendor applications, so we check those first. Across the river bridge, LaVerkin, and up the road Toquerville and Leeds, are small towns with their own history and their own page: <a href="/dirty-soda-laverkin-toquerville-leeds">LaVerkin, Toquerville and Leeds</a>. In Hurricane we do backyard parties, ward activities, Hurricane High booster nights, HOA socials in the newer neighborhoods and <a href="/st-george-graduation-birthday-party">graduation open houses</a>.'),
  ('Family reunions and vacation rentals', 'A lot of families gather in the rentals around Sand Hollow and Hurricane, with a pool, a big yard and three generations under one roof for the week. That&#39;s a perfect private booking: we pull up for a couple of hours, pour for everybody, and the cousins talk about the float bar for years. Check your rental&#39;s rules on vendors and parking, tell us the head count, and we&#39;ll quote it. Further out, like Springdale or the Zion side, ask and we&#39;ll put any travel in the quote.'),
  ('Trails, off-road weekends and the heat', 'Hurricane is a base camp for Gooseberry Mesa, the trails along the Hurricane Cliffs and the dunes out by Sand Mountain. Ride groups and off-road weekends start early and end hot. We open the morning with espresso and sweet-cream cold brew, then switch to dirty sodas, lemonades and floats over nugget ice as the day heats up. Summer afternoons here pass 100 degrees, so for a midday event we&#39;ll suggest a short menu and a window that keeps the line moving. Event organizers set their own vendor rules, so tell us the event and we&#39;ll check first.'),
  ('Where you&#39;ll find us in Hurricane', NOT_OPEN + 'Until then, the fastest way to get the trailer to Hurricane or Sand Hollow is to <a href="/utah-dirty-soda-catering?city=Hurricane#quote">book it for your own event</a>. Planning a reception? See <a href="/st-george-wedding-soda-bar">southern Utah weddings</a>, or head back to <a href="/dirty-soda-st-george">St. George</a>.'),
 ],
 'chips': ['Sand Hollow', 'Quail Creek'],
 'events_h': 'Hurricane-area events we do',
 'faq_h': 'Hurricane and Sand Hollow dirty soda FAQ',
 'faq': [
  ('Do you come to Hurricane, LaVerkin and Toquerville?', 'Yes. They&#39;re part of our Washington County home area, with St. George, where we open first. LaVerkin, Toquerville and Leeds have <a href="/dirty-soda-laverkin-toquerville-leeds">their own page</a>. <a href="/utah-dirty-soda-catering?city=Hurricane#quote">Send the date, place and head count</a> and we&#39;ll reply with a price within one business day.'),
  ('Can you set up at Sand Hollow State Park?', 'Commercial vendors need the park&#39;s permission to sell inside a Utah state park, so a group day there takes planning. Ask early and we&#39;ll work through it with you, or meet your group at a rental, a home or a private lot nearby.'),
  ('Can you come to a family reunion at a vacation rental?', 'Yes. Check the rental&#39;s rules on vendors and parking, and make sure a truck and trailer can pull onto a flat spot. Then send the head count and we&#39;ll quote it.'),
  ('Can you vend at a Hurricane festival or a Legacy Park event?', 'Often, if the organizer approves us. County and festival events usually have their own concession or vendor rules, so we check what yours needs before we quote. We only list a public stop once it&#39;s booked.'),
  ('How do you handle the summer heat out here?', 'Every drink is poured over nugget ice and soft serve is made on the trailer. For midday summer events we suggest a short menu and a morning or evening window so nobody waits long in the sun.'),
  ('When will the trailer be open?', 'We&#39;re not open for public stops yet, and we won&#39;t make up a date. Stops go on the homepage stops list and live map the minute they&#39;re booked. Private events are booking now.'),
 ],
},
{
 'slug': 'dirty-soda-desert-color', 'city_q': 'Desert%20Color', 'soon': 'Desert Color', 'crumb': 'Desert Color',
 'title': 'Desert Color Dirty Soda, St. George, UT | Thirsty Beaches',
 'desc': 'A retro dirty soda, soft-serve and espresso trailer for Desert Color birthdays, rental-house reunions, HOA nights and lagoon-day parties in St. George.',
 'schema_desc': 'A retro dirty soda trailer opening first in St. George, Utah, and booking private events in Desert Color, the master-planned community along I-15 and the Southern Parkway.',
 'h1': 'Dirty soda in Desert Color, St. George',
 'lede': 'St. George has a beach, and it&#39;s in Desert Color. Dirty sodas built to order, real soft-serve floats and fresh espresso for backyard birthdays, rental-house reunions and neighborhood nights, from a retro trailer that comes to you.',
 'cta': 'Book a Desert Color Event',
 'sections': [
  ('A beach inside St. George', 'Desert Color is the master-planned community along I-15 and the Southern Parkway, on the land east of the interstate. Its centerpiece is the lagoon at The Shores: about two and a half acres of water with more than half a mile of white-sand shoreline, which the community calls the largest private body of water in the St. George area. People swim, kayak and paddleboard there in a desert town. We named the trailer Thirsty Beaches and built it around one idea, bringing the beach to you, so a neighborhood with its own beach is about as close to home as it gets. Utah&#39;s best-known chain started in St. George, so nobody here needs dirty soda explained. What we add is real soft serve and fresh espresso in the same trailer, so any soda can become a float and the morning crowd gets an iced latte.'),
  ('Rental houses, reunions and pool-day parties', 'Desert Color has vacation rentals, some with a private pool, and families book them so three generations can stay under one roof for the week. That is a perfect private booking for us: we pull up to the house for a couple of hours, pour for everybody, and the cousins line up for floats. Check your rental&#39;s rules on vendors and parking first, and make sure a truck and trailer can pull onto a flat spot nearby. Residents throw the same parties at home: a birthday by the pool, a graduation open house, a welcome party for the family that just moved onto the street. Kid sizes, zero-sugar sodas and caffeine-free lemonades and Italian sodas mean the grandparents and the toddlers both get something.'),
  ('The resort side runs its own drinks', 'The Shores Resort has its own pool-deck caf&eacute;, Atara has its own restaurants, and Crush Golf + Grill has its own dining and private event spaces. Those places run their own food and drinks, so we don&#39;t set up at the lagoon, the resort pools or a restaurant without their invitation, and an event held there goes through them first. The community also sets the rules for its pools, parks and amenities. For a lagoon day, the easy version is to meet you back at your home or rental afterward, when everyone is sandy, sunburned and thirsty.'),
  ('A neighborhood calendar that never stops', 'Desert Color runs a busy community calendar of its own. It lists summer kickoff events with food trucks, dive-in movie nights, holiday lights, car shows, pinewood derbies and moonlight 5Ks, and it has its own parks, about six miles of trails and a pickleball park at Akoya Pearl Community Park with six courts, a performing pavilion and an activity lawn. If you sit on an HOA, a neighborhood committee or an event team and want a drink trailer at a community night, talk to whoever runs the event and then to us. Organizers set their own vendor rules, so we&#39;ll check what yours needs before we quote. The HOA can cover everyone, set a cap, or let neighbors buy their own. See <a href="/st-george-hoa-neighborhood-party">HOA and neighborhood parties</a>.'),
  ('Floats on the hottest days', 'Summer afternoons in St. George regularly pass 100 degrees, and that is exactly when a soft-serve float beats everything else on the board. Every drink is poured over nugget ice, and cones and shakes cover anyone skipping the soda. For a midday summer party we&#39;ll suggest a short menu and a morning or evening window so nobody waits in the sun. Morning crowds headed to pickleball get espresso and sweet-cream cold brew; evening crowds get the full dirty soda board.'),
  ('Birthdays, graduations and the 55+ crowd', 'Desert Color has everything from vacation rentals and family homes to a 55+ community, so the parties range from a seventh birthday to a seventieth. Kids want anything blue; grandparents want a caffeine-free lemonade or a Diet Coke with coconut. We&#39;ll name a drink after the birthday kid or the graduate and match the syrups to the school colors. See <a href="/st-george-graduation-birthday-party">graduation and birthday parties</a>. Elsewhere in town, <a href="/dirty-soda-bloomington-green-valley">Bloomington and Green Valley</a> are on the southwest side, and <a href="/dirty-soda-st-george">St. George</a> is where the trailer opens first.'),
  ('Where you&#39;ll find us in Desert Color', NOT_OPEN + 'Until then, the fastest way to get the trailer to Desert Color is to <a href="/utah-dirty-soda-catering?city=Desert%20Color#quote">book it for your own event</a>.'),
 ],
 'chips': ['The Shores', 'Southern Parkway'],
 'events_h': 'Desert Color events we do',
 'faq_h': 'Desert Color dirty soda FAQ',
 'faq': [
  ('Do you come to Desert Color?', 'Yes. Desert Color is part of St. George, where we open first. <a href="/utah-dirty-soda-catering?city=Desert%20Color#quote">Send the date, place and head count</a> and we&#39;ll reply with a price within one business day.'),
  ('Can you set up at The Shores lagoon or the resort pools?', 'Not on our own. The resort, its pool-deck caf&eacute; and the restaurants in Desert Color run their own food and drinks, and the community sets the rules for its amenities. We&#39;ll meet you at your home or rental instead, or come to a community event if its organizer invites us.'),
  ('Can you come to a vacation rental in Desert Color?', 'Yes. Check the rental&#39;s rules on vendors and parking, and make sure a truck and trailer can pull onto a flat spot. Then send the head count and we&#39;ll quote it.'),
  ('Can our HOA or neighborhood book you for a community night?', 'Yes. The HOA can cover everyone, set a cap, or let neighbors buy their own. Tell us what your HOA or event organizer requires from vendors and we&#39;ll confirm we can meet it before we quote.'),
  ('Do you have kid sizes and caffeine-free drinks?', 'Yes. Beach Babies kid sizes, soft-serve cones, zero-sugar sodas, and lemonades and Italian sodas with no caffeine.'),
  ('When will the trailer be open?', 'We&#39;re not open for public stops yet, and we won&#39;t make up a date. Stops go on the homepage stops list and live map the minute they&#39;re booked. Private events are booking now.'),
 ],
},
{
 'slug': 'dirty-soda-bloomington-green-valley', 'city_q': 'Bloomington%20or%20Green%20Valley', 'soon': 'Bloomington and Green Valley', 'crumb': 'Bloomington &amp; Green Valley',
 'title': 'Bloomington, Green Valley Dirty Soda, UT | Thirsty Beaches',
 'desc': 'A retro dirty soda and soft-serve trailer for Bloomington, Bloomington Hills and Green Valley backyard parties, HOA socials and family nights, St. George.',
 'schema_desc': 'A retro dirty soda trailer opening first in St. George, Utah, and booking private events on the southwest side of town: Bloomington, Bloomington Hills and Green Valley.',
 'h1': 'Dirty soda in Bloomington and Green Valley, St. George',
 'lede': 'The southwest side of St. George, from old Bloomington on the Virgin River to the resort streets of Green Valley. Dirty sodas built to order, real soft serve and fresh espresso for backyard parties, clubhouse socials and family nights, from a retro trailer that comes to you.',
 'cta': 'Book a Bloomington or Green Valley Event',
 'sections': [
  ('Bloomington: the town before the town', 'Bloomington was a pioneer settlement before it was a St. George neighborhood. The Carpenter family settled the northwest side of the Virgin River and called the place Jamestown; they raised cotton and sugar cane, made molasses and started a broom business. The surveyor renamed it Bloomington, and by the middle of the last century the families were gone. Then a developer began marketing a country club community here, with a golf course at its heart. The Washington County Historical Society calls it the first planned community in Utah and the spark that finally put St. George on the map. Today Bloomington is golf-course streets, the old Manzanita Road settlement and Bloomington Petroglyph Park, all on the river side of town.'),
  ('Green Valley: a ranch that became a resort', 'Green Valley, on the west side of town, started as a six-hundred-acre ranch. Once it was annexed into St. George, the first subdivision went in, and then The Park at Green Valley, which came with an owners association, a clubhouse, a pool and courts at a time when that was new for St. George. The Sports Village, Las Palmas, The Cottages and the Green Valley Spa followed, and condos that were rented to visitors helped make Green Valley a place people come to stay. That mix of long-time owners and visiting families is exactly who books a trailer: a clubhouse social for the residents, or a reunion for the family that rented three condos for the week.'),
  ('Backyards, cul-de-sacs and clubhouse lots', 'The parties we hear about on the southwest side are mostly at home: a birthday in a big Bloomington backyard, a graduation open house in the driveway, a missionary homecoming on the cul-de-sac, a pool-day social at the HOA clubhouse. We need a flat spot that a truck and trailer can pull into, close enough to your guests that the line feels like part of the party. The trailer runs on its own generator and carries its own water, so no hookup is needed. If the HOA owns the clubhouse lot, get its OK first. A party that moves into a public street or a city park can need a city permit, so ask us and we&#39;ll walk through it. More on <a href="/st-george-hoa-neighborhood-party">HOA and neighborhood parties</a> and <a href="/st-george-graduation-birthday-party">graduations and birthdays</a>.'),
  ('Golf-course neighborhoods and club rules', 'Country clubs and resorts usually run their own food and drinks, and their event contracts often say so. If your event is at a clubhouse or a resort, check with its events team first; if outside vendors are allowed, we&#39;ll work with them on where to park and when to load in. A party at a home on the course is simpler: you decide, as long as your HOA agrees.'),
  ('Early tee times and hot afternoons', 'Southwest St. George mornings start early. We pull espresso to order, so a 7&nbsp;a.m. group gets iced lattes and sweet-cream cold brew, then the board switches to dirty sodas, lemonades and floats over nugget ice as the day warms up. Summer afternoons regularly pass 100 degrees, so for a midday summer party we&#39;ll suggest a short menu and a morning or evening window. Zero-sugar sodas, caffeine-free lemonades and Italian sodas, and Beach Babies kid sizes cover the whole family.'),
  ('Wards, schools and the rest of town', 'Wards and stakes on this side of town book us for youth nights and ward parties, and PTAs and booster clubs book teacher thank-yous and fundraisers. See <a href="/st-george-church-school-events">church and school events</a>. Further south, <a href="/dirty-soda-desert-color">Desert Color</a> has its own lagoon and community calendar, and out west <a href="/dirty-soda-santa-clara">Santa Clara</a> and <a href="/dirty-soda-ivins">Ivins</a> have pages of their own. Back in the middle of it all, <a href="/dirty-soda-st-george">St. George</a> is where the trailer opens first.'),
  ('Where you&#39;ll find us on the southwest side', NOT_OPEN + 'Until then, the fastest way to get the trailer to Bloomington or Green Valley is to <a href="/utah-dirty-soda-catering?city=Bloomington%20or%20Green%20Valley#quote">book it for your own event</a>.'),
 ],
 'chips': ['Bloomington Hills', 'Virgin River'],
 'events_h': 'Southwest St. George events we do',
 'faq_h': 'Bloomington and Green Valley dirty soda FAQ',
 'faq': [
  ('Do you come to Bloomington, Bloomington Hills and Green Valley?', 'Yes. They&#39;re part of St. George, where we open first. <a href="/utah-dirty-soda-catering?city=Bloomington%20or%20Green%20Valley#quote">Send the date, place and head count</a> and we&#39;ll reply with a price within one business day.'),
  ('Can you serve at a country club or resort?', 'If the venue allows outside food and beverage vendors, yes. Many clubs and resorts run their own food and drinks, so check your event contract or ask the events team first.'),
  ('Can our HOA book you at the clubhouse?', 'Yes, with the HOA&#39;s OK. The HOA can cover everyone, set a cap, or let residents buy their own. Tell us what the HOA requires from vendors and we&#39;ll confirm we can meet it before we quote.'),
  ('Do you need power or water at the house?', 'No. The trailer runs on its own generator and carries its own water. We just need a flat spot a truck and trailer can pull into.'),
  ('What do you serve?', 'Dirty sodas built to order, real soft serve (cones, cups, shakes and floats), fresh espresso, lemonades and Italian sodas, plus zero-sugar versions and Beach Babies kid sizes. See the <a href="/menu">menu</a>.'),
  ('When will the trailer be open?', 'We&#39;re not open for public stops yet, and we won&#39;t make up a date. Stops go on the homepage stops list and live map the minute they&#39;re booked. Private events are booking now.'),
 ],
},
{
 'slug': 'dirty-soda-santa-clara', 'city_q': 'Santa%20Clara', 'soon': 'Santa Clara', 'crumb': 'Santa Clara',
 'title': 'Santa Clara, Utah Dirty Soda Trailer | Thirsty Beaches',
 'desc': 'A retro dirty soda and soft-serve trailer for Santa Clara, Utah backyard receptions, graduation open houses, reunions and ward parties. Booking events now.',
 'schema_desc': 'A retro dirty soda trailer opening first in St. George and booking events next door in Santa Clara, Utah, the old Swiss pioneer town on the Santa Clara River.',
 'h1': 'Dirty soda in Santa Clara, Utah',
 'lede': 'Old orchards, Swiss pioneer roots and a main street lined with painted cows during Swiss Days. Dirty sodas built to order, real soft serve and fresh espresso for Santa Clara backyard receptions, open houses and family parties, from a retro trailer that comes to you.',
 'cta': 'Book a Santa Clara Event',
 'sections': [
  ('The town the Swiss settlers built', 'Santa Clara is older than most of the county. It began as the headquarters of Jacob Hamblin&#39;s Indian Mission on the Santa Clara River, and then a company of Swiss converts was sent south to settle it. Weeks after they arrived, a long rain flooded the river and destroyed the fort and the first settlement, and the earlier settlers moved over to the land where the Swiss families had settled. The Swiss knew how to grow grapes, and the warm climate turned out to be ideal for fruit; the Washington County Historical Society says Santa Clara became the fruit and vegetable garden of the county, and fruit stayed the town&#39;s main living for more than half a century.'),
  ('Swiss Days and Santa Clara Drive', 'The city&#39;s Swiss Days celebration honors those Swiss pioneers. The city describes a parade along Santa Clara Drive from the Jacob Hamblin Home to City Hall, pioneer activities at Heritage Square, live entertainment, local food and merchandise vendors, and decorated cows that residents and businesses display along Santa Clara Drive and in their yards. Vendors go through the city&#39;s own sign-up. If the trailer is ever part of a Swiss Days weekend, it will be because the city accepted us, and it will go on our stops list then. A private party at your own home is always an easy booking.'),
  ('Family parties in a family town', 'Santa Clara still feels like the small town it grew from, and the parties we hear about here are family ones: graduation open houses, missionary farewells and homecomings, reunions, birthdays and the backyard reception after a wedding. Old orchard lots and big yards usually have room for the trailer. We need a flat spot a truck and trailer can pull into, close to your guests, and the trailer brings its own power and water. Kid sizes, zero-sugar sodas and caffeine-free lemonades and Italian sodas mean the grandparents and the toddlers both get something. See <a href="/st-george-wedding-soda-bar">receptions and open houses</a> and <a href="/st-george-graduation-birthday-party">graduations and birthdays</a>.'),
  ('Wards, schools and teams', 'Wards and stakes book us for youth nights, ward parties and trek send-offs. Lava Ridge Intermediate is in Santa Clara, and west-side PTAs and booster clubs book teacher thank-yous, carnival nights and team fundraisers. If your activity is at a meetinghouse, the building&#39;s rules come first, so a covered tab with no sales is usually the simplest fit, or we can meet you at a park or a home. See <a href="/st-george-church-school-events">church and school events</a> and <a href="/st-george-tournaments-team-parties">tournaments and team parties</a>.'),
  ('Santa Clara summers', 'Summer afternoons here regularly pass 100 degrees, so we plan around the heat: a morning open house with iced lattes and sweet-cream cold brew, or an evening party once the sun drops. Every drink is poured over nugget ice, and the soft-serve machine turns any soda into a float. For a midday event we&#39;ll suggest a short menu and a time window that keeps the line moving.'),
  ('Next door: Ivins and St. George', 'Santa Clara and <a href="/dirty-soda-ivins">Ivins</a> are next-door neighbors on the west side of the county, and the trailer covers both. Ivins started out as the Santa Clara Bench, and it has Kayenta and the red-rock resorts. Back toward town, <a href="/dirty-soda-bloomington-green-valley">Bloomington and Green Valley</a> are on the southwest side, and <a href="/dirty-soda-st-george">St. George</a> is where we open first.'),
  ('Where you&#39;ll find us in Santa Clara', NOT_OPEN + 'Until then, the fastest way to get the trailer to Santa Clara is to <a href="/utah-dirty-soda-catering?city=Santa%20Clara#quote">book it for your own event</a>.'),
 ],
 'chips': ['Santa Clara Drive', 'Santa Clara River'],
 'events_h': 'Santa Clara events we do',
 'faq_h': 'Santa Clara dirty soda FAQ',
 'faq': [
  ('Do you come to Santa Clara?', 'Yes. Santa Clara is next door to St. George, where we open first. <a href="/utah-dirty-soda-catering?city=Santa%20Clara#quote">Send the date, place and head count</a> and we&#39;ll reply with a price within one business day.'),
  ('Will you be at Swiss Days?', 'Only if the city accepts us as a vendor, since Swiss Days vendors go through the city&#39;s own sign-up. We only list a public stop once it&#39;s booked. A private party at your home that weekend is easy to book.'),
  ('Can you park at an older home or on a narrow street?', 'Usually. We need a flat spot a truck and trailer can pull into, like a driveway, a side lot or a wide street edge, close to your guests. Tell us about the spot and we&#39;ll plan it when we quote.'),
  ('Can you come to a ward activity?', 'Yes. Ask your bishopric or building representative about the meetinghouse rules first; a covered tab with no sales is usually the simplest fit. A park or a member&#39;s home works well too.'),
  ('Do you have drinks for kids and caffeine-free options?', 'Yes. Beach Babies kid sizes, soft-serve cones, zero-sugar sodas, and lemonades and Italian sodas with no caffeine.'),
  ('When will the trailer be open?', 'We&#39;re not open for public stops yet, and we won&#39;t make up a date. Stops go on the homepage stops list and live map the minute they&#39;re booked. Private events are booking now.'),
 ],
},
{
 'slug': 'dirty-soda-ivins', 'city_q': 'Ivins', 'soon': 'Ivins', 'crumb': 'Ivins',
 'title': 'Ivins, Utah Dirty Soda and Float Trailer | Thirsty Beaches',
 'desc': 'A retro dirty soda, soft-serve and espresso trailer for Ivins and Kayenta receptions, red-rock backyard parties and family get-togethers. Booking now.',
 'schema_desc': 'A retro dirty soda trailer opening first in St. George and booking events in Ivins, Utah, including Kayenta and the neighborhoods by Snow Canyon State Park.',
 'h1': 'Dirty soda in Ivins, Utah',
 'lede': 'Red cliffs, black lava and a town that started as the Santa Clara Bench. Dirty sodas built to order, real soft-serve floats and fresh espresso for Kayenta receptions, backyard parties and family get-togethers on the Snow Canyon side, from a retro trailer that comes to you.',
 'cta': 'Book an Ivins Event',
 'sections': [
  ('From the Santa Clara Bench to Ivins', 'Ivins began as farmland on the Santa Clara Bench, settled about a century ago by families descended from Swiss immigrants, who farmed it with water carried by canal from the Santa Clara River. After the chapel was dedicated, the settlers chose to name the town after Anthony W. Ivins, and he agreed on one condition, according to the Washington County Historical Society: that they spell it Ivins, not Ivens. Today it is a growing city near Snow Canyon State Park, and the parties here still tend to happen at home, on a patio with a view of the red cliffs. That is where a trailer beats a drive-thru: we park, we pour for everybody, and nobody loads the kids in the car for a soda run.'),
  ('Kayenta and the art village', 'Kayenta covers about 2,200 acres of Ivins, and most of it borders open space. Its art village has galleries, a caf&eacute;, the Center for the Arts at Kayenta and a desert labyrinth laid out in small stones. It is one of the prettiest places in Utah to throw a reception, a shower or an open house, and a neon-pink trailer looks good in the photos against red rock. Kayenta has its own homeowners association, so check its rules on vendors and street parking before you book, and tell us where the trailer can pull in. More on <a href="/st-george-wedding-soda-bar">southern Utah receptions</a>.'),
  ('Tuacahn, Black Desert and the resorts', 'Ivins is home to Tuacahn Center for the Arts and its outdoor amphitheater, and to resorts including Black Desert, with a golf course laid through the black lava fields, Red Mountain and others. Theaters, resorts and their restaurants run their own food and drinks, so we don&#39;t set up there without their invitation, and an event held there goes through the venue first. If you&#39;re staying in a rental or a family home nearby, a private party there is easy: check the rental&#39;s rules on vendors and parking, and we&#39;ll handle the rest.'),
  ('Fire Lake Park, Snow Canyon and the heat', 'Ivins has a beach of its own too: Fire Lake Park at Ivins Reservoir has a beach and a swim area. City parks have their own rules, so for a party at Fire Lake or another Ivins park we&#39;ll check what the city needs first. Snow Canyon State Park is on the doorstep, and commercial vendors need the park&#39;s permission to sell inside a Utah state park, so for a trailhead group or a race we&#39;ll meet you at a home or a private lot nearby instead. Summer afternoons pass 100 degrees, so we plan morning events with iced lattes or evening parties after the rock cools off, all over nugget ice.'),
  ('Heritage Days, schools and wards', 'The city holds its own Ivins Heritage Days, and organizers set their own vendor rules, so ask the city before you picture us there; we only list a public stop once it&#39;s booked. Red Mountain Elementary is in Ivins, and west-side PTAs and booster clubs book teacher thank-yous and fundraisers. Wards and stakes book youth nights and ward parties. See <a href="/st-george-church-school-events">church and school events</a>.'),
  ('Next door: Santa Clara and St. George', 'Ivins and <a href="/dirty-soda-santa-clara">Santa Clara</a> sit side by side on the west edge of Washington County, and the trailer covers both. Back toward town, <a href="/dirty-soda-bloomington-green-valley">Bloomington and Green Valley</a> are on the southwest side of <a href="/dirty-soda-st-george">St. George</a>, where we open first.'),
  ('Where you&#39;ll find us in Ivins', NOT_OPEN + 'Until then, the fastest way to get the trailer to Ivins is to <a href="/utah-dirty-soda-catering?city=Ivins#quote">book it for your own event</a>.'),
 ],
 'chips': ['Kayenta', 'Snow Canyon', 'Fire Lake'],
 'events_h': 'Ivins events we do',
 'faq_h': 'Ivins dirty soda FAQ',
 'faq': [
  ('Do you come to Ivins and Kayenta?', 'Yes. Ivins is part of our Washington County home area, next to St. George, where we open first. <a href="/utah-dirty-soda-catering?city=Ivins#quote">Send the date, place and head count</a> and we&#39;ll reply with a price within one business day.'),
  ('Can you serve at Tuacahn or one of the resorts?', 'Only if the venue invites outside food and beverage vendors. Theaters and resorts usually run their own food and drinks, so check your event contract or ask the venue first. Private homes and rentals are the easiest.'),
  ('Can you come to a home in Kayenta?', 'Yes. Check the homeowners association&#39;s rules on vendors and street parking, and make sure a truck and trailer can pull onto a flat spot. Then send the head count and we&#39;ll quote it.'),
  ('Can you set up at Snow Canyon State Park?', 'Not without the park&#39;s permission, since commercial vendors need it to sell inside a Utah state park. For a group day, we&#39;ll meet you at a home or a private lot nearby.'),
  ('Do you have drinks for kids and caffeine-free options?', 'Yes. Beach Babies kid sizes, soft-serve cones, zero-sugar sodas, and lemonades and Italian sodas with no caffeine.'),
  ('When will the trailer be open?', 'We&#39;re not open for public stops yet, and we won&#39;t make up a date. Stops go on the homepage stops list and live map the minute they&#39;re booked. Private events are booking now.'),
 ],
},
{
 'slug': 'dirty-soda-laverkin-toquerville-leeds', 'city_q': 'LaVerkin%2C%20Toquerville%20or%20Leeds', 'soon': 'LaVerkin, Toquerville and Leeds', 'crumb': 'LaVerkin, Toquerville &amp; Leeds',
 'title': 'LaVerkin, Toquerville and Leeds Dirty Soda | Thirsty Beaches',
 'desc': 'A self-powered dirty soda and soft-serve trailer for LaVerkin, Toquerville, Leeds and Silver Reef backyard parties, reunions and ward activities.',
 'schema_desc': 'A retro dirty soda trailer opening first in St. George and booking events in the small towns north of Hurricane: LaVerkin, Toquerville, Leeds and Silver Reef, Utah.',
 'extra_area': [LAVERKIN, TOQUERVILLE, LEEDS],
 'h1': 'Dirty soda in LaVerkin, Toquerville and Leeds, Utah',
 'lede': 'The small towns north of Hurricane, along the Virgin River, Ash Creek and the old road to Silver Reef. Dirty sodas built to order, real soft serve and fresh espresso for backyard parties, reunions and ward activities, from a self-powered retro trailer that comes to you.',
 'cta': 'Book an Event Up North',
 'sections': [
  ('LaVerkin: canals, orchards and the overlook', 'LaVerkin sits between Hurricane and Toquerville, across the river bridge from Hurricane. It was farmland first, then a surveyed townsite, and the LaVerkin Canal, the LaVerkin Fruit and Nursery Company, the old hot springs at Pah Tempe and the LaVerkin Overlook, with its view across the Hurricane Valley, are all part of the town&#39;s story. It is still a small town, and a backyard there is an easy place to park a drink trailer.'),
  ('Toquerville: the old town on Ash Creek', 'Toquerville is about nineteen miles northeast of St. George on State Route 17. Its settlers built near the village of Toquer, the Paiute leader who befriended them, and the town took his name; the Washington County Historical Society says the word means black, for the volcanic mountain the town sits beneath. Toquerville had the first cotton gin in the state, grew fruit in its warm climate and was even a county seat for a while. Today it is a quiet town where a graduation open house or a reunion fills the whole street, and that is the kind of party we built the trailer for.'),
  ('Leeds and Silver Reef', 'Leeds sits along I-15 near exits 22 and 23. It was organized as Bennington and renamed after Leeds, England, where its bishop had served a mission. Its first business was grapes and wine, and then it supplied the nearby mining town of Silver Reef. Leeds passed its own historic preservation ordinance, and the Silver Reef Museum now fills the old Wells Fargo Express building, on a monument site owned by Washington County. Historic sites and museums set their own rules, so an event there goes through them first. A backyard in Leeds is simpler.'),
  ('A trailer that brings its own power', 'Out here the party is often on a big lot, a family property or a ranch-style yard without an outlet anywhere near it. That is fine: the trailer runs on its own generator and carries its own water, so we only need a flat spot that a truck and trailer can pull into. We do backyard receptions, reunions, birthday parties, missionary farewells and homecomings, ward activities and booster nights. These towns are a longer drive from St. George, so we&#39;ll include any travel in the quote, and the math works best when there&#39;s a crowd.'),
  ('Toward Zion and the long summer', 'Further up the road toward Springdale and Zion, ask and we&#39;ll put the drive in the quote. We don&#39;t set up inside the national park; we&#39;ll meet a group at a home or a rental outside it. Summer afternoons up here pass 100 degrees just like in St. George, so we plan morning events with espresso and sweet-cream cold brew or evening parties with floats and dirty sodas over nugget ice.'),
  ('The rest of the county', 'South across the river, <a href="/dirty-soda-hurricane-sand-hollow">Hurricane and Sand Hollow</a> have their own page, and so does <a href="/dirty-soda-washington-city">Washington City</a>. <a href="/dirty-soda-st-george">St. George</a> is where the trailer opens first. Planning a reception or a family milestone? See <a href="/st-george-wedding-soda-bar">southern Utah weddings</a> and <a href="/st-george-graduation-birthday-party">graduations and birthdays</a>.'),
  ('Where you&#39;ll find us up north', NOT_OPEN + 'Until then, the fastest way to get the trailer to LaVerkin, Toquerville or Leeds is to <a href="/utah-dirty-soda-catering?city=LaVerkin%2C%20Toquerville%20or%20Leeds#quote">book it for your own event</a>.'),
 ],
 'chips': ['Silver Reef', 'Ash Creek'],
 'events_h': 'Small-town events we do',
 'faq_h': 'LaVerkin, Toquerville and Leeds dirty soda FAQ',
 'faq': [
  ('Do you come to LaVerkin, Toquerville and Leeds?', 'Yes. They&#39;re part of Washington County, where we open first. <a href="/utah-dirty-soda-catering?city=LaVerkin%2C%20Toquerville%20or%20Leeds#quote">Send the date, place and head count</a> and we&#39;ll reply with a price within one business day.'),
  ('Is there a travel charge?', 'These towns are a longer drive from St. George, so any travel is included up front in your quote. Bigger groups make the drive pencil out best.'),
  ('Do you need power or water?', 'No. The trailer runs on its own generator and carries its own water. We just need a flat spot a truck and trailer can pull into.'),
  ('Can you set up at Silver Reef or another historic site?', 'Only with the site&#39;s permission, since museums and historic sites set their own rules. We&#39;ll check with them before we quote. A private yard nearby is the simplest option.'),
  ('Do you go to Springdale or Zion?', 'Ask, and we&#39;ll put any travel in the quote. We don&#39;t set up inside the national park; we can meet your group at a home or rental outside it.'),
  ('When will the trailer be open?', 'We&#39;re not open for public stops yet, and we won&#39;t make up a date. Stops go on the homepage stops list and live map the minute they&#39;re booked. Private events are booking now.'),
 ],
},
]

if __name__ == '__main__':
    for p in PAGES: build(p)
