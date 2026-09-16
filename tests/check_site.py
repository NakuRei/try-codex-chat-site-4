"""Checks for the static site. Requires Playwright only for browser checks.

Normal use: python tests/check_site.py
Restricted browser runtime: python tests/check_site.py --dom-only
Use --screenshots DIR to save desktop and mobile previews.
"""
from __future__ import annotations

import argparse
import functools
import json
import shutil
import threading
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
KEY = 'hoshizora-tsushin-v1'
PAGES = sorted(ROOT.rglob('*.html'))


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'Duplicate ID: {attrs["id"]}'
            self.ids.add(attrs['id'])
        if tag == 'a' and attrs.get('href'):
            self.references.append((tag, attrs['href']))
        if tag in ('script', 'img') and attrs.get('src'):
            self.references.append((tag, attrs['src']))
        if tag == 'link' and attrs.get('href'):
            self.references.append((tag, attrs['href']))


def check_links():
    parsed = {}
    for path in PAGES:
        parser = References()
        parser.feed(path.read_text(encoding='utf-8'))
        parsed[path.resolve()] = parser
    count = 0
    for path, parser in parsed.items():
        for tag, ref in parser.references:
            url = urlparse(ref)
            assert not url.scheme and not url.netloc, f'External dependency/link: {path} {ref}'
            target = (path.parent / unquote(url.path)).resolve() if url.path else path
            assert target.is_relative_to(ROOT), f'Path escapes site: {ref}'
            assert target.is_file(), f'Missing target: {path.name} -> {ref}'
            if url.fragment and target in parsed:
                assert unquote(url.fragment) in parsed[target].ids, f'Missing anchor: {ref}'
            count += 1
    print(f'PASS: {len(PAGES)} HTML documents; {count} local links/assets/anchors')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dom-only', action='store_true', help='No browser URL navigation; DOM test double for storage')
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    check_links()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(SimpleHTTPRequestHandler, directory=ROOT))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.server_port}/'
    try:
        # Exercise relative paths as a GitHub Pages-style project subdirectory.
        class ProjectHandler(SimpleHTTPRequestHandler):
            def __init__(self, *a, **kw):
                super().__init__(*a, directory=ROOT.parent, **kw)
        subserver = ThreadingHTTPServer(('127.0.0.1', 0), ProjectHandler)
        threading.Thread(target=subserver.serve_forever, daemon=True).start()
        try:
            for path in [*PAGES, ROOT/'style.css', ROOT/'site.js', ROOT/'banner.svg', ROOT/'favicon.svg']:
                relative = path.relative_to(ROOT).as_posix()
                with urlopen(f'http://127.0.0.1:{subserver.server_port}/{ROOT.name}/{relative}') as response:
                    assert response.status == 200
                    assert response.read() == path.read_bytes()
            print('PASS: HTTP delivery of all pages/assets beneath a project subdirectory (Python client)')
        finally:
            subserver.shutdown()
        with sync_playwright() as p:
            executable = shutil.which('chromium') or shutil.which('google-chrome')
            browser = p.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
            ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
            pg = ctx.new_page()
            errors = []
            pg.on('pageerror', lambda error: errors.append(str(error)))
            cache = {}
            css = (ROOT/'style.css').read_text(encoding='utf-8')
            js = (ROOT/'site.js').read_text(encoding='utf-8')

            def load(name, blocked=False, raw=None, with_js=True):
                nonlocal cache, pg
                if not args.dom_only:
                    pg.close()
                    pg = ctx.new_page()
                    pg.on('pageerror', lambda error: errors.append(str(error)))
                    if blocked:
                        pg.add_init_script("Object.defineProperty(window, 'localStorage', {get(){throw new DOMException('blocked','SecurityError')}})")
                    pg.goto(base + name)
                    if raw is not None:
                        pg.evaluate('(v) => localStorage.setItem(' + json.dumps(KEY) + ', v)', raw)
                        pg.reload()
                    return
                if raw is not None:
                    cache[KEY] = raw
                # Only the test copy has resource URLs replaced; production files are unmodified.
                html = (ROOT/name).read_text(encoding='utf-8')
                prefix = '../' if '/' in name else ''
                html = html.replace(f'<link rel="stylesheet" href="{prefix}style.css">', f'<style>{css}</style>')
                html = html.replace(f'<script src="{prefix}site.js" defer></script>', '')
                html = html.replace(f'<link rel="icon" href="{prefix}favicon.svg" type="image/svg+xml">', '')
                import base64
                banner = base64.b64encode((ROOT/'banner.svg').read_bytes()).decode()
                html = html.replace('src="banner.svg"', f'src="data:image/svg+xml;base64,{banner}"')
                # A fresh page is important: no accumulated event handlers/timers between documents.
                pg.close()
                pg = ctx.new_page()
                pg.on('pageerror', lambda error: errors.append(str(error)))
                pg.set_content(html, wait_until='domcontentloaded')
                if blocked:
                    pg.evaluate("Object.defineProperty(window, 'localStorage', {get(){throw new DOMException('blocked','SecurityError')}})")
                else:
                    pg.evaluate('''(data) => {
                        window.__storage = {...data};
                        Object.defineProperty(window, 'localStorage', {value: {
                            getItem(k) {return window.__storage[k] ?? null},
                            setItem(k,v) {window.__storage[k]=String(v)},
                            removeItem(k) {delete window.__storage[k]}
                        }});
                    }''', cache)
                if with_js:
                    pg.add_script_tag(content=js)

            def save_cache():
                nonlocal cache
                if args.dom_only:
                    cache = pg.evaluate('window.__storage')

            def found(id):
                return pg.locator(f'[data-found="{id}"]').is_visible()

            # Full story route, including wrong answers and repeated play.
            load('index.html')
            assert pg.locator('h1').inner_text() == 'ほしぞら通信'
            assert pg.locator('dialog, .browser, .toolbar, .sidebar, #fragments').count() == 0
            pg.locator('#fortune').click()
            assert '吉' in pg.locator('#fortune-result').inner_text()
            load('diary.html')
            pg.locator('[data-diary-star="red"]').click(); assert not found('diary')
            pg.locator('[data-diary-star="blue"]').click(); assert found('diary')
            save_cache(); load('diary.html'); assert found('diary')
            load('bbs.html')
            pg.locator('[name="name"]').fill('<img src=x onerror=alert(1)>')
            pg.locator('[name="message"]').fill('<script>throw new Error("unsafe")</script>')
            pg.locator('[name="number"]').fill('1999'); pg.locator('#bbs-form button[type="submit"]').click()
            assert not found('bbs')
            assert pg.locator('#local-posts script, #local-posts img').count() == 0
            assert '<script>' in pg.locator('#local-posts').inner_text()
            pg.locator('[name="number"]').fill('００２００１'); pg.locator('#bbs-form button[type="submit"]').click()
            assert found('bbs'); save_cache(); load('bbs.html')
            assert pg.locator('#local-posts article').count() == 2
            load('lost/404.html')
            pg.locator('#reveal-ink').click(); assert 'revealed' in pg.locator('#secret-ink').get_attribute('class')
            pg.locator('[name="answer"]').fill('まちがい'); pg.locator('#lost-form button').click(); assert not found('links')
            pg.locator('[name="answer"]').fill(' ヨリミチ '); pg.locator('#lost-form button').click(); assert found('links'); save_cache()
            load('under_construction.html')
            pg.locator('[data-lamp="1"]').click(); assert not found('works')
            pg.locator('#reset-lamps').click()
            for i in (0,4,8): pg.locator(f'[data-lamp="{i}"]').click()
            assert found('works'); assert pg.locator('.lamp.on').count() == 0
            save_cache()
            load('observatory.html')
            pg.locator('#play-stars').click()
            pg.locator('[data-star="0"]').click(); assert not found('stars')
            for i in (2,0,3,1): pg.locator(f'[data-star="{i}"]').click()
            assert found('stars'); save_cache()
            load('secret.html')
            pg.locator('[name="answer"]').fill('まちがい'); pg.locator('#secret-form button').click()
            assert not pg.locator('#letter').is_visible()
            pg.locator('[name="answer"]').fill(' ホ シ ノ ウ ミ '); pg.locator('#secret-form button').click()
            assert pg.locator('#letter').is_visible(); save_cache(); load('secret.html')
            assert pg.locator('#letter').is_visible()
            assert all(json.loads(cache[KEY])['found'][id] for id in ['diary','bbs','links','works','stars']) if args.dom_only else True
            print('PASS: five puzzles, incorrect answers, normalization, ending, saved-state restore, safe BBS text')

            # Animated and touch variants, plus navigation/visibility cleanup.
            load('observatory.html')
            pg.emulate_media(reduced_motion='no-preference')
            pg.locator('#play-stars').click(); pg.wait_for_timeout(4000)
            assert pg.locator('[data-star="2"]').is_enabled()
            for i in (2,0,3,1): pg.locator(f'[data-star="{i}"]').click()
            pg.locator('#play-stars').click()
            pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
            pg.wait_for_timeout(900)
            assert pg.locator('.sky-star.lit').count() == 0
            pg.locator('#still-stars').check(); pg.locator('#play-stars').click()
            assert '3 → 1 → 4 → 2' in pg.locator('#star-result').inner_text()
            print('PASS: animated stars, static alternative and timer cleanup')

            load('music.html')
            assert pg.locator('#music-stop').is_disabled()
            pg.locator('#music-play').click()
            pg.wait_for_timeout(150)
            assert pg.locator('#music-stop').is_enabled()
            pg.locator('#music-stop').click(); assert pg.locator('#music-stop').is_disabled()
            load('cat.html'); pg.locator('#pet-cat').click(); assert 'ごろごろ' in pg.locator('#cat-result').inner_text()
            print('PASS: opt-in Web Audio start/stop and cat interaction')

            # Existing v1 data is preserved, then deliberately removed with confirmation.
            legacy = json.dumps({'found': {'diary': True}, 'posts': [{'name':'以前の訪問者','message':'足跡です'}], 'complete':False,'quiet':True})
            load('bbs.html', raw=legacy)
            assert '以前の訪問者' in pg.locator('#local-posts').inner_text()
            save_cache(); load('diary.html'); assert found('diary')
            load('profile.html')
            pg.locator('.technical summary').click()
            pg.locator('#reset-form button').click(); save_cache()
            if args.dom_only: assert KEY in cache
            pg.locator('#reset-check').check(); pg.locator('#reset-form button').click(); save_cache()
            if args.dom_only: assert KEY not in cache
            print('PASS: migration of original v1 records; deletion requires checkbox confirmation')

            # Corruption and denied storage must not make the website or ending unusable.
            load('diary.html', raw='{bad-json')
            pg.locator('[data-diary-star="blue"]').click(); assert found('diary')
            load('diary.html', blocked=True)
            pg.locator('[data-diary-star="blue"]').click(); assert found('diary')
            load('secret.html', blocked=True)
            pg.locator('[name="answer"]').fill('ほしのうみ'); pg.locator('#secret-form button').click()
            assert pg.locator('#letter').is_visible()
            print('PASS: invalid JSON and denied storage; password works without collection/save gating')

            # Rendering every document at representative phone/desktop widths.
            for width in (320, 390, 768, 1280):
                for path in PAGES:
                    load(path.relative_to(ROOT).as_posix())
                    pg.set_viewport_size({'width':width,'height':900})
                    assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (width,path.name)
            print('PASS: all 13 pages at 320/390/768/1280px, no page-wide horizontal overflow')
            if args.screenshots:
                for name, width in [('desktop',1280), ('mobile',390)]:
                    load('index.html'); pg.set_viewport_size({'width':width,'height':900})
                    pg.screenshot(path=str(args.screenshots/f'hoshizora-website-{name}.png'),full_page=True)
                load('diary.html'); pg.set_viewport_size({'width':1100,'height':900})
                pg.screenshot(path=str(args.screenshots/'hoshizora-website-diary.png'),full_page=True)

            # Server HTML contains the content and normal hyperlinks even without execution.
            for path in PAGES:
                load(path.relative_to(ROOT).as_posix(), with_js=False)
                assert pg.locator('h1').inner_text().strip()
                assert pg.locator('a[href="index.html"], a[href="../index.html"]').count() > 0
                assert pg.locator('body').inner_text().strip()
            if not args.dom_only:
                nojs = browser.new_context(java_script_enabled=False)
                for path in PAGES:
                    q = nojs.new_page(); q.goto(base+path.relative_to(ROOT).as_posix())
                    assert q.locator('h1').inner_text().strip(); q.close()
                nojs.close()
                pg.goto(base+'index.html'); pg.locator('.contents a[href="diary.html"]').click()
                assert pg.url.endswith('/diary.html'); pg.reload(); assert pg.locator('#aug31').is_visible()
                pg.go_back(); assert pg.url.endswith('/index.html')
                print('PASS: browser HTTP navigation, reload, back and JavaScript-disabled documents')
            else:
                print('PASS: static content without loading site.js (DOM mode, not live HTTP navigation)')
            assert not errors, errors
            print('PASS: zero browser JavaScript exceptions')
            print('MODE:', 'DOM-only; storage mocked; browser HTTP/file navigation unavailable' if args.dom_only else 'real HTTP browser navigation')
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
