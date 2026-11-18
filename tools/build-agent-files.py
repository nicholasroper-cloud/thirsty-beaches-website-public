#!/usr/bin/env python3
"""Build the AI-agent versions of the site from the HTML that's already there.

For every page in site/sitemap.xml this writes a Markdown copy of the page's <main> content
(/index.md, /menu.md, /dirty-soda-lehi.md, or /guides/index.md for folder pages), then:
  - site/llms.txt        curated index for agents (summary + key facts from tools/agent-config.json)
  - site/llms-full.txt   every page's Markdown in one file
  - functions/_md-map.js map of page path -> Markdown path, used by functions/_middleware.js to answer
                         `Accept: text/markdown` requests and to send a `Link: rel="alternate"` header
and adds <link rel="alternate" type="text/markdown"> to each page's <head>.

Run after any content change:  python3 tools/build-agent-files.py
The deploy workflow runs it too, so the Markdown never drifts from the HTML. No dependencies.
"""
import html, json, os, re, sys
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
CFG = json.load(open(os.path.join(ROOT, 'tools', 'agent-config.json')))
BASE = CFG['base_url'].rstrip('/')

SKIP = {'script', 'style', 'noscript', 'svg', 'template', 'form', 'input', 'select', 'textarea',
        'button', 'label', 'iframe', 'canvas', 'video', 'audio', 'dialog', 'nav', 'footer', 'option'}
BLOCK = {'p', 'div', 'section', 'article', 'header', 'aside', 'figure', 'figcaption', 'ul', 'ol',
         'table', 'tr', 'blockquote', 'details', 'main', 'dl', 'dt', 'dd', 'address'}
VOID = {'br', 'img', 'hr', 'meta', 'link', 'input', 'source', 'wbr', 'col', 'area', 'base', 'embed', 'track'}


class MD(HTMLParser):
    def __init__(self, page_url):
        super().__init__(convert_charrefs=True)
        self.url = page_url
        self.out, self.line = [], ''
        self.skip = 0           # depth inside skipped elements
        self.hidden = 0         # depth inside aria-hidden / hidden elements
        self.stack = []
        self.href = None
        self.link_text = ''
        self.li_depth = 0
        self.in_li_spans = 0

    # -- helpers
    def flush(self, blank=True):
        t = re.sub(r'[ \t]+', ' ', self.line).strip()
        if t:
            self.out.append(t)
        if blank and (not self.out or self.out[-1] != ''):
            self.out.append('')
        self.line = ''

    def emit(self, text):
        if self.href is not None:
            self.link_text += text
        else:
            self.line += text

    # -- parser hooks
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in VOID:
            if tag == 'br' and not (self.skip or self.hidden):
                self.emit(' ')
            if tag == 'img' and not (self.skip or self.hidden) and a.get('alt', '').strip():
                self.emit(' ' + a['alt'].strip() + ' ')
            return
        hidden = a.get('aria-hidden') == 'true' or 'hidden' in a
        self.stack.append((tag, tag in SKIP, hidden))
        if tag in SKIP:
            self.skip += 1
            return
        if hidden:
            self.hidden += 1
            return
        if self.skip or self.hidden:
            return
        if self.href is not None and (re.fullmatch(r'h[1-6]', tag) or tag in BLOCK or tag in ('li', 'span')):
            # a whole card wrapped in a link: keep it one link, parts separated by dashes
            if self.link_text.strip() and not self.link_text.rstrip().endswith('—'):
                self.link_text = self.link_text.rstrip() + ' — '
            return
        if re.fullmatch(r'h[1-6]', tag):
            self.flush()
            self.line = '#' * int(tag[1]) + ' '
        elif tag == 'li':
            self.flush(blank=False)
            self.li_depth += 1
            self.line = '  ' * (self.li_depth - 1) + '- '
        elif tag == 'summary':
            self.flush()
            self.line = '**'
        elif tag in BLOCK or tag in ('td', 'th'):
            if tag in ('td', 'th'):
                self.emit(' | ')
            else:
                self.flush(blank=tag not in ('ul', 'ol', 'dl'))
        elif tag in ('strong', 'b'):
            self.emit('**')
        elif tag in ('em', 'i') and not a.get('class'):
            self.emit('*')
        elif tag == 'a' and 'card' in (a.get('class') or ''):
            self.flush(blank=False)                 # link cards (sayings, packages): one per line
            self.line = '- '
        elif tag in ('span', 'a') and not (self.skip or self.hidden):
            cls = a.get('class') or ''
            body = self.line.rstrip()
            starts_item = re.fullmatch(r'\s*(- )?', self.line) is not None
            if 'chip' in cls and body and not starts_item:
                self.line = body + ' · '          # chip rows: "Lehi · Provo · Orem"
            elif tag == 'span' and self.li_depth and not starts_item and not body.endswith(('·', '(')):
                self.line = body + ' · '          # menu rows: name · description · price
            elif self.line and (self.line[-1].isalnum() or (tag == 'a' and self.line.endswith(')'))):
                self.line += ' · ' if self.line.endswith(')') else ' '
        if tag == 'a':
            href = a.get('href', '')
            if href and not href.startswith(('javascript:', 'mailto:', 'tel:', 'sms:')):
                self.href = urljoin(self.url, href)
                self.link_text = ''
            elif href.startswith(('mailto:', 'tel:')):
                self.href = href
                self.link_text = ''

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        # pop to the matching tag (tolerate sloppy HTML)
        while self.stack:
            t, was_skip, was_hidden = self.stack.pop()
            if was_skip:
                self.skip -= 1
            elif was_hidden:
                self.hidden -= 1
            else:
                self._close(t)
            if t == tag:
                break

    def _close(self, tag):
        if self.skip or self.hidden:
            return
        if self.href is not None and tag != 'a' and (re.fullmatch(r'h[1-6]', tag) or tag in BLOCK or tag in ('li', 'summary')):
            return
        if re.fullmatch(r'h[1-6]', tag):
            self.flush()
        elif tag == 'li':
            self.flush(blank=False)
            self.li_depth = max(0, self.li_depth - 1)
            if self.li_depth == 0:
                pass
        elif tag == 'summary':
            self.line = self.line.rstrip() + '**'
            self.flush(blank=False)
        elif tag in BLOCK:
            self.flush(blank=tag not in ('dt',))
        elif tag == 'a' and self.href is not None:
            text = re.sub(r'\s+', ' ', self.link_text).strip().rstrip('— ').strip()
            href, self.href = self.href, None
            if text:
                self.line += f'[{text}]({href})'
            if self.line.startswith('- ['):
                self.flush(blank=False)
        elif tag in ('strong', 'b'):
            self.emit('**')
        elif tag in ('em', 'i'):
            if self.line.count('*') % 2:
                self.emit('*')

    def handle_data(self, data):
        if self.skip or self.hidden:
            return
        self.emit(data.replace('\n', ' '))

    def markdown(self):
        self.flush()
        text = '\n'.join(self.out)
        text = re.sub(r'\*\*\s*\*\*', '', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'^- \s*$\n?', '', text, flags=re.M)
        text = re.sub(r'^\s*\*{1,2}\s*$\n?', '', text, flags=re.M)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip() + '\n'


def meta(s, name, attr='name'):
    m = re.search(rf'<meta {attr}="{re.escape(name)}" content="([^"]*)"', s)
    return html.unescape(m.group(1)) if m else ''


def page_file(path):
    """URL path -> (html file, markdown file, markdown URL path)."""
    if path.endswith('/'):
        rel = path.lstrip('/') + 'index.html'
        md_rel = path.lstrip('/') + 'index.md'
    else:
        rel = path.lstrip('/') + '.html'
        md_rel = path.lstrip('/') + '.md'
    return os.path.join(SITE, rel), os.path.join(SITE, md_rel), '/' + md_rel


def convert(path):
    src, md_file, md_url = page_file(path)
    s = open(src, encoding='utf-8').read()
    title = html.unescape(re.search(r'<title>(.*?)</title>', s, re.S).group(1)).strip()
    desc = meta(s, 'description')
    main = re.search(r'<main\b.*?</main>', s, re.S)
    body = main.group(0) if main else s.split('<body', 1)[1]
    p = MD(BASE + path)
    p.feed(body)
    md = p.markdown()
    # one H1: if the page's own H1 is there, keep it; else lead with the title
    md = md.lstrip()
    if md.startswith('# '):                     # page has its own H1: lead with it
        h1, _, md = md.partition('\n')
        head = h1 + '\n\n'
        md = md.lstrip()
    else:
        h1s = re.findall(r'^# .*$', md, flags=re.M)
        if h1s:                                 # H1 further down (after an eyebrow line): move it up
            head = h1s[0] + '\n\n'
            md = md.replace(h1s[0] + '\n', '', 1).lstrip()
        else:
            head = f'# {title}\n\n'
    front = f'> {desc}\n\n' if desc else ''
    canon = f'Canonical page: {BASE}{path}\n\n'
    out = head + front + canon + md
    os.makedirs(os.path.dirname(md_file), exist_ok=True)
    open(md_file, 'w', encoding='utf-8').write(out)
    # advertise the Markdown copy in <head> (idempotent)
    tag = f'<link rel="alternate" type="text/markdown" href="{md_url}">'
    if 'type="text/markdown"' not in s:
        s2 = s.replace('</head>', f'{tag}\n</head>', 1)
        open(src, 'w', encoding='utf-8').write(s2)
    elif tag not in s:
        s2 = re.sub(r'<link rel="alternate" type="text/markdown" href="[^"]*">', tag, s, count=1)
        open(src, 'w', encoding='utf-8').write(s2)
    return {'path': path, 'md': md_url, 'title': title, 'desc': desc, 'markdown': out}


def main():
    sm = open(os.path.join(SITE, 'sitemap.xml'), encoding='utf-8').read()
    paths = [urlparse(u).path or '/' for u in re.findall(r'<loc>([^<]+)</loc>', sm)]
    pages = []
    for path in paths:
        src = page_file(path)[0]
        if not os.path.exists(src):
            print('  skip (no file):', path, file=sys.stderr)
            continue
        pages.append(convert(path))
    by_path = {p['path']: p for p in pages}

    # functions/_md-map.js
    mp = {p['path']: p['md'] for p in pages}
    if '/' in mp:
        mp['/index.html'] = mp['/']
    for p in pages:
        if not p['path'].endswith('/') and p['path'] != '/':
            mp[p['path'] + '.html'] = p['md']
    js = ('// Generated by tools/build-agent-files.py. Do not edit.\n'
          '// Page path -> Markdown copy, for Accept: text/markdown and the Link: rel="alternate" header.\n'
          'export default ' + json.dumps(mp, indent=1) + ';\n')
    open(os.path.join(ROOT, 'functions', '_md-map.js'), 'w').write(js)

    # llms.txt
    L = [f"# {CFG['name']}", '', f"> {CFG['summary']}", '']
    L += [CFG['about'].strip(), '']
    if CFG.get('facts'):
        L += ['## Key facts', ''] + [f'- {f}' for f in CFG['facts']] + ['']
    if CFG.get('actions'):
        L += ['## How to act on this site', ''] + [f'- {a}' for a in CFG['actions']] + ['']
    used = set()
    for section in CFG['sections']:
        L += [f"## {section['title']}", '']
        for path in section['paths']:
            if path in by_path:
                p = by_path[path]; used.add(path)
                note = p['desc'] or p['title']
                L.append(f"- [{p['title']}]({BASE}{p['md']}): {note}")
        L.append('')
    rest = [p for p in pages if p['path'] not in used]
    if rest:
        L += ['## Optional', '']
        L += [f"- [{p['title']}]({BASE}{p['md']}): {p['desc'] or p['title']}" for p in rest] + ['']
    L += [f"Every page above is also available as HTML at the same address without `.md`, and any page "
          f"returns Markdown when requested with `Accept: text/markdown`. Full text of all pages: {BASE}/llms-full.txt", '']
    open(os.path.join(SITE, 'llms.txt'), 'w', encoding='utf-8').write('\n'.join(L))

    # llms-full.txt
    full = [f"# {CFG['name']} (all pages)", '', f"> {CFG['summary']}", '']
    for p in pages:
        full += ['---', '', p['markdown']]
    open(os.path.join(SITE, 'llms-full.txt'), 'w', encoding='utf-8').write('\n'.join(full))
    print(f'built {len(pages)} Markdown pages, llms.txt, llms-full.txt, functions/_md-map.js')


if __name__ == '__main__':
    main()
