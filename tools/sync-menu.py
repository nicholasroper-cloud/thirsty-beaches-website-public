#!/usr/bin/env python3
"""Rebuild site/menu.html sections (+ schema, counts) and the home-page category cards
from the Clover catalog and the kiosk recipes.  Clover = names/prices/categories (truth).
Recipes = descriptions.  Existing hand-written descriptions on the page are kept.

  python3 tools/clover-items.py ../Thirstybeaches-kiosk/.env /tmp/items.json   (read-only pull)
  python3 tools/sync-menu.py /tmp/items.json
"""
import json,re,sys,html,os,collections
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE=os.path.join(ROOT,'site')
RECIPES=os.path.join(os.path.dirname(ROOT),'ThirstyBeaches-Kiosk-Drive','recipes.json')
items=json.load(open(sys.argv[1]))
rc=json.load(open(RECIPES))['recipes']
norm=lambda x:re.sub(r'[^a-z0-9]','',x.lower())
rn={norm(k):v for k,v in rc.items()}

ORDER=['Dirty Sodas','Seasonal','Refreshers','Coffee','New Waves','Lemonades','Italian Sodas','Rescue – Energy Drinks','Soft Serve','Floats','Beach Babies','Treats']
NOTES={'Dirty Sodas':'Pick your soda base, syrup, fruit pur&eacute;e and cream.',
 'Seasonal':'Limited runs that come and go with the calendar. Ask what\'s pouring.',
 'Refreshers':'No soda, no coffee. Fruit, cream and water over ice, most with sugar-free syrups.',
 'Coffee':'Hot or iced, your milk, your syrups.',
 'New Waves':'The energy-and-fruit end of the menu.',
 'Lemonades':'Shaken, fruited, dangerously easy.',
 'Italian Sodas':'Cream and syrup over soda.',
 'Energy':'For when the day started too early.',
 'Soft Serve':'Twist, cones, cups, shakes.',
 'Floats':'Soft serve, dropped in.',
 'Beach Babies':'Smaller sizes for the little ones.',
 'Treats':'Freeze-dried candy, made in house.'}
CARD_BLURB={'Dirty Sodas':'Your base, your syrup, cream over nugget ice','Seasonal':'Fall, Halloween, winter and Valentine\'s runs','Refreshers':'Fruit and cream over ice, no soda, no caffeine','Coffee':'Espresso, drip and everything sweeter','New Waves':'The energy-and-fruit end of the menu','Lemonades':'Shaken, fruited, dangerously easy','Italian Sodas':'Cream and syrup over soda','Rescue – Energy Drinks':'For when the day needs saving','Soft Serve':'Twist, cones, cups, shakes','Floats':'Soft serve, dropped in','Beach Babies':'Smaller sizes for the little ones','Treats':'Freeze-dried candy, made in house'}
UNIT={'Dirty Sodas':'builds','Soft Serve':'ways','Floats':'builds','Treats':'sizes'}
slug=lambda c:re.sub(r'[^a-z0-9]+','-',c.lower()).strip('-')

# ingredient wording
REP=[(r'\bSF\b','sugar-free'),(r'\bPuree\b','pur&eacute;e'),(r'Blended Swig Energy','energy base'),(r'\bSwig Energy\b','energy base'),(r'Whipped Cream Garnish','whipped cream'),(r'\bGarnish\b','')]
def ing(x):
    for a,b in REP: x=re.sub(a,b,x)
    return x.strip()
def desc_from_recipe(r):
    if not r or not r.get('i'): return ''
    BRAND=['Dr Pepper','Coke','Diet Coke','Coke Zero','Sprite','Mountain Dew','Big Red','Fanta','Red Bull','Swig','Oreo','Reese','Kit Kat','Nutella','Starburst','Skittles','Sour Patch','Nerds','Lucky Charms','Fruit Loops','Froot Loops']
    def cap(x):
        x=x.lower()
        for b in BRAND: x=re.sub(r'\b'+re.escape(b.lower())+r'\b',b,x)
        return x
    parts=[cap(ing(i)) for i in r['i']]; parts=[p for p in parts if p and p!='water']
    parts=[p[0].upper()+p[1:] if i==0 else p for i,p in enumerate(parts)]
    d=', '.join(parts)
    if r.get('note'): d+='. '+r['note'].rstrip('.')
    return d

# existing descriptions on the page
mp=os.path.join(SITE,'menu.html'); s=open(mp).read()
old={norm(html.unescape(re.sub('<[^>]+>','',n))):d for n,d in re.findall(r'<span class="row__n">(.*?)</span><span class="row__d">(.*?)</span>',s,re.S)}
SPECIAL={'thirsttrapdrpeppercoconut':'Thirst Trap','freezedriedcandysmall':'Freeze-Dried Candy &mdash; Small','freezedriedcandymedium':'Freeze-Dried Candy &mdash; Medium','freezedriedcandylarge':'Freeze-Dried Candy &mdash; Large'}

by=collections.defaultdict(list)
for it in items:
    if it['hidden']: continue
    cat=(it['cats'] or ['Other'])[0]
    nm=SPECIAL.get(norm(it['name']),html.escape(it['name'],quote=False))
    k=norm(it['name']); r=rn.get(k) or rn.get(norm(nm))
    d=old.get(k) or old.get(norm(html.unescape(nm))) or desc_from_recipe(r) or 'Ask at the window'
    sub=(r or {}).get('c','')
    by[cat].append({'name':nm,'raw':it['name'],'price':it['price'],'desc':d,'sub':sub})
for c in by: by[c].sort(key=lambda x:x['raw'].lower())
cats=[c for c in ORDER if c in by]+[c for c in by if c not in ORDER]
total=sum(len(by[c]) for c in cats)
# Seasonal grouped by sub-season
SEASON_ORDER=['Seasonal – Fall','Seasonal – Halloween','Seasonal – Winter',"Seasonal – Valentine's"]
# badges: only where the description makes it certain (every part sugar-free/diet; a caffeinated base)
CAF=re.compile(r'\b(coke|pepsi|dr pepper|mountain dew|energy base|espresso|latte|cappuccino|americano|cold brew|drip coffee|mocha)\b')
SFP=re.compile(r'^(diet |sugar[- ]free |sparkling water$|fresh (lime|lemon)$)')
def badges(name,desc):
    n=html.unescape(re.sub('<[^>]+>','',name)).lower(); d=html.unescape(re.sub('<[^>]+>','',desc)).lower()
    parts=[x.strip() for x in d.split(',') if x.strip()]
    out=''
    if parts and all(SFP.match(x) for x in parts):
        out+='<span class="tag tag--sf" title="Sugar-free">SF<span class="sr-only"> (sugar-free)</span></span>'
    if CAF.search(n+' '+d):
        out+='<span class="tag tag--caf">Caffeine</span>'
    return f'<span class="row__b">{out}</span>' if out else ''
def rows(lst):
    return '\n'.join(f'        <li class="row"><span class="row__n">{x["name"]}</span><span class="row__d">{x["desc"]}</span><span class="row__p">${x["price"]:.2f}</span>{badges(x["name"],x["desc"])}</li>' for x in lst)
secs=[]
for c in cats:
    body=''
    if c=='Seasonal':
        groups=collections.OrderedDict()
        for x in sorted(by[c],key=lambda x:(SEASON_ORDER.index(x['sub']) if x['sub'] in SEASON_ORDER else 99,x['raw'].lower())):
            groups.setdefault(x['sub'].replace('Seasonal – ','') or 'Seasonal',[]).append(x)
        for g,lst in groups.items():
            body+=f'      <h3 class="menu__sub">{html.escape(g,quote=False)}</h3>\n      <ul class="menu__grid">\n{rows(lst)}\n      </ul>\n'
    else:
        body=f'      <ul class="menu__grid">\n{rows(by[c])}\n      </ul>\n'
    secs.append(f'    <div class="menu__sec" id="{slug(c)}" data-cat="{slug(c)}">\n      <h2 class="menu__h">{c}</h2>\n      <p class="menu__note">{NOTES.get(c,"")}</p>\n      <div class="menu__rule"></div>\n{body}    </div>\n')
sections='\n'.join(secs)
filters='      <button class="pill" type="button" data-cat="all" aria-pressed="true">All</button>\n'+'\n'.join(f'      <button class="pill" type="button" data-cat="{slug(c)}">{c}</button>' for c in cats)

# splice: filters
s=re.sub(r'(<div class="filters">\n).*?(\n    </div>)',lambda m:m.group(1)+filters+m.group(2),s,count=1,flags=re.S)
# splice: sections (from first menu__sec to noResults)
s=re.sub(r'    <div class="menu__sec".*?(?=\n    <p class="empty" id="noResults")',sections.rstrip('\n'),s,count=1,flags=re.S)
# schema
schema={"@context":"https://schema.org","@type":"Menu","@id":"https://thirstybeaches.com/menu#menu","name":"Thirsty Beaches Menu","url":"https://thirstybeaches.com/menu","inLanguage":"en-US","hasMenuSection":[{"@type":"MenuSection","name":c,"hasMenuItem":[{"@type":"MenuItem","name":html.unescape(x['name']).replace('—','-'),"description":html.unescape(re.sub('<[^>]+>','',x['desc'])),"offers":{"@type":"Offer","price":f"{x['price']:.2f}","priceCurrency":"USD"}} for x in by[c]]} for c in cats]}
s=re.sub(r'<script type="application/ld\+json">\{"@context": "https://schema.org", "@type": "Menu".*?</script>','<script type="application/ld+json">'+json.dumps(schema,ensure_ascii=False)+'</script>',s,count=1,flags=re.S)
# counts
W={66:'Sixty-six'}
word=W.get(total,str(total))
s=re.sub(r'Menu — \d+ Dirty Sodas','Menu — %d Dirty Sodas'%total,s)
s=re.sub(r'Menu — \d+ drinks','Menu — %d drinks'%total,s)
s=re.sub(r'<p class="lede">[A-Za-z0-9-]+ drinks, every one built',f'<p class="lede">{word} drinks, every one built',s)
s=re.sub(r'Search \d+ drinks','Search %d drinks'%total,s)
open(mp,'w').write(s)

# home page cards + counts
ip=os.path.join(SITE,'index.html'); h=open(ip).read()
cards='\n'.join(f'      <a class="card" href="/menu#{slug(c)}"><span class="card__tag">{len(by[c])} {UNIT.get(c,"drinks")}</span><h3>{c}</h3><p>{CARD_BLURB.get(c,"")}</p></a>' for c in cats)
h=re.sub(r'(<div class="cards">\n).*?(\n    </div>)',lambda m:m.group(1)+cards+m.group(2),h,count=1,flags=re.S)
h=re.sub(r'see all \d+ drinks','see all %d drinks'%total,h)
h=re.sub(r'<p class="lede">[A-Za-z0-9-]+ drinks, all built to order',f'<p class="lede">{word} drinks, all built to order',h)
h=re.sub(r'<h2 class="h2">\w+ ways to get thirsty</h2>',f'<h2 class="h2">{ {10:"Ten",11:"Eleven",12:"Twelve",13:"Thirteen"}.get(len(cats),len(cats)) } ways to get thirsty</h2>'.replace('{ ','{').replace(' }','}'),h)
h=re.sub(r'[A-Za-z0-9-]+ drinks on the board',f'{word} drinks on the board',h)
open(ip,'w').write(h)
print('total',total,'cats',len(cats),{c:len(by[c]) for c in cats})
print('no recipe / fallback desc:',[x['raw'] for c in cats for x in by[c] if x['desc']=='Ask at the window'])
