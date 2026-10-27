"""Build-time TLPT shell and content-derived asset references. No runtime fetches."""
import hashlib
from html import escape, unescape
import json
from pathlib import Path
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
# Explicit ownership: never rewrite Lily, Marchand, Cashier or the RSVP app.
PAGES = tuple(sorted((
    '404.html', 'champions.html', 'dashboard.html', 'form-lab.html', 'gallery.html',
    'index.html', 'knockouts.html', 'media.html', 'news.html', 'player-movement.html',
    'player.html', 'players.html', 'rebuy-hard.html', 'register.html', 'rsvp-app.html',
    'rules.html', 'schedule.html', 'standings.html', 'streaks.html', 'structures.html',
    'trophy-room.html', 'voice-of-god.html',
)))


def asset_version(name, root=ROOT):
    target = (root / name).resolve()
    if not target.is_relative_to(root.resolve()) or not target.is_file():
        raise ValueError(f'Missing or unsafe local asset: {name}')
    return hashlib.sha256(target.read_bytes()).hexdigest()[:16]


def asset_reference(name, root=ROOT):
    return f'{name}?v={asset_version(name, root)}'


def version_assets(source, root=ROOT):
    def tag(match):
        text = match.group()
        def attribute(attr):
            raw = unescape(attr['url'])
            url = urlsplit(raw)
            if url.scheme or url.netloc or not url.path.endswith(('.css', '.js', '.mjs')):
                return attr.group()
            name = url.path.lstrip('/')
            query = [('v', asset_version(name, root))]
            query += [(k, v) for k, v in parse_qsl(url.query, keep_blank_values=True) if k != 'v']
            updated = urlunsplit(('', '', url.path, urlencode(query), url.fragment))
            return attr['prefix'] + escape(updated, quote=True) + attr['quote']
        return re.sub(r'(?P<prefix>\b(?:href|src)=(?P<quote>["\']))(?P<url>.*?)(?P=quote)', attribute, text)
    return re.sub(r'<(?:link|script)\b[^>]*>', tag, source, flags=re.I)


def navigation(page, root=ROOT):
    entries = json.loads((root / 'templates/site/navigation.json').read_text())
    prefix = '/' if page == '404.html' else ''
    def path(item):
        return urlsplit(item['href']).path
    def anchor(item, classes=(), current=False):
        href = item['href']
        if urlsplit(href).scheme or href.startswith('/') or '..' in Path(path(item)).parts:
            raise ValueError(f'Navigation must link to owned relative pages: {href}')
        if path(item) not in PAGES or not (root / path(item)).is_file():
            raise ValueError(f'Unknown navigation page: {href}')
        attrs = (' class="' + ' '.join(classes) + '"') if classes else ''
        if current:
            attrs += ' aria-current="page"'
        return f'<a href="{escape(prefix + href, quote=True)}"{attrs}>{escape(item["label"])}</a>'
    blocks = []
    for item in entries:
        children = item.get('children', [])
        own_match = path(item) == page
        child_match = any(path(child) == page for child in children)
        if not children:
            blocks.append('      ' + anchor(item, ['is-active'] if own_match else [], own_match))
            continue
        classes = ['nav-dropdown-parent'] + (['is-active'] if own_match or child_match else [])
        links = '\n'.join('          ' + anchor(child, ['is-active'] if path(child) == page else [], path(child) == page) for child in children)
        blocks.append('      <div class="nav-dropdown">\n        ' + anchor(item, classes, own_match and not child_match)
                      + '\n        <div class="nav-dropdown-menu">\n' + links + '\n        </div>\n      </div>')
    return '\n\n'.join(blocks)


def render_page(page, source=None, root=ROOT):
    if page not in PAGES:
        raise ValueError(f'Page is outside TLPT shell ownership: {page}')
    if source is None:
        source = (root / page).read_text()
    for part in ('header', 'footer'):
        template = (root / f'templates/site/{part}.html').read_text().strip()
        template = template.replace('{{ROOT}}', '/' if page == '404.html' else '')
        template = template.replace('{{NAVIGATION}}', navigation(page, root))
        start = f'<!-- TLPT GENERATED {part.upper()}: edit templates/site/{part}.html -->'
        end = f'<!-- END TLPT GENERATED {part.upper()} -->'
        if '{{' in template:
            raise ValueError(f'Unresolved placeholder in {part}')
        # Existing generated regions are authoritative; legacy matching bootstraps
        # the migration without changing any page-specific body content.
        pattern = (re.escape(start) + r'.*?' + re.escape(end)) if start in source else rf'<{part}\b[^>]*class="site-{part}"[^>]*>.*?</{part}>'
        source, count = re.subn(pattern, lambda _: start + '\n' + template + '\n' + end, source, flags=re.S)
        if count != 1:
            raise ValueError(f'{page}: expected exactly one shared {part}, found {count}')
    return version_assets(source, root)


def synchronize(root=ROOT, check=False):
    changed = []
    # Render all first: a missing asset/template never leaves a partial update.
    rendered = {page: render_page(page, root=root) for page in PAGES}
    for page, result in rendered.items():
        target = root / page
        if target.read_text() != result:
            changed.append(page)
            if not check:
                target.write_text(result)
    return changed
