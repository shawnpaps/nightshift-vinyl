"""HTTP smoke tests. Cart writes run only when the rendered demo banner is present."""
import http.cookiejar
import json
import os
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, build_opener, HTTPCookieProcessor, HTTPRedirectHandler

BASE = os.environ.get('BASE_URL', 'http://localhost:4321')

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.links, self.forms, self.scripts = [], [], []
        self.form = None
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a': self.links.append(attrs.get('href', ''))
        if tag == 'script': self.scripts.append(attrs)
        if tag == 'form':
            self.form = {'attrs': attrs, 'fields': []}
            self.forms.append(self.form)
        if self.form is not None and tag in ('input','button') and attrs.get('name') and 'disabled' not in attrs:
            self.form['fields'].append((attrs['name'], attrs.get('value', '')))
    def handle_endtag(self, tag):
        if tag == 'form': self.form = None

jar = http.cookiejar.CookieJar()
client = build_opener(HTTPCookieProcessor(jar))
def get(path, data=None, headers=None):
    request = Request(urljoin(BASE, path), data=data, headers=headers or {})
    try:
        with client.open(request, timeout=40) as response:
            return response.status, response.headers, response.read().decode()
    except HTTPError as response:
        return response.code, response.headers, response.read().decode()

status, headers, html = get('/')
assert status == 200, ('home', status)
page = Page(html)
assert sum(s.get('id') == 'shopify-standard-actions' for s in page.scripts) == 1
assert sum(s.get('id') == 'shopify-analytics-bus' for s in page.scripts) == 1
product = next(href for href in page.links if href.startswith('/products/'))
collection = next(href for href in page.links if href.startswith('/collections/'))
for path in ['/', '/collections', '/search', '/account', '/cart', collection, product, '/search?q=patch', collection+'?sort_by=price-descending&filter.v.price.gte=10.5']:
    status, _, body = get(path)
    assert status == 200, (path, status)
    print('PASS', path)
status, _, body = get('/api/cart')
assert status == 200 and json.loads(body)['cart'] is None
status, _, body = get('/api/2026-10/graphql.json',json.dumps({'query':'{ shop { name } }'}).encode(),{'Content-Type':'application/json'})
assert status == 200 and json.loads(body).get('data',{}).get('shop',{}).get('name'), body
assert get('/this-route-does-not-exist')[0] == 404
assert get('/products/this-product-does-not-exist')[0] == 404
assert get('/collections/this-collection-does-not-exist')[0] == 404
print('PASS Shopify API proxy, empty cart, and missing-resource status codes')

if 'Demo catalog' in html:
    _, _, body = get(product)
    form = next(f for f in Page(body).forms if any(k == 'add-to-cart' for k,v in f['fields']))
    status, headers, body = get(form['attrs']['action'],urlencode(form['fields']).encode(),{'Content-Type':'application/x-www-form-urlencoded','Referer':urljoin(BASE,product),'Origin':BASE,'Accept':'text/html'})
    assert status == 200, ('native cart form',status)
    assert any(cookie.name == 'cart' for cookie in jar), 'cart cookie was not set'
    status, headers, body = get('/cart')
    line_form = next((f for f in Page(body).forms if any(k == 'lineId' for k,v in f['fields'])),None)
    assert status == 200 and line_form and ('intent','set') in line_form['fields'], 'cart was not server-rendered'
    assert 'private' in headers.get('Cache-Control','') or 'no-store' in headers.get('Cache-Control',''), dict(headers)
    status, _, body = get('/api/cart')
    cart = json.loads(body)['cart']
    assert cart['totalQuantity'] == 1, cart
    print('PASS native rendered add-to-cart form → cart cookie → server-rendered cart')
    for intent,quantity,expected in [('set','2',2),('remove','2',0)]:
        fields = [(k,quantity if k == 'quantity' else v) for k,v in line_form['fields'] if k != 'intent'] + [('intent',intent)]
        assert get(line_form['attrs']['action'],urlencode(fields).encode(),{'Content-Type':'application/x-www-form-urlencoded','Referer':urljoin(BASE,'/cart'),'Origin':BASE,'Accept':'text/html'})[0] == 200
        cart = json.loads(get('/api/cart')[2])['cart']
        assert cart['totalQuantity'] == expected, (intent,cart)
    print('PASS server-rendered quantity-set and remove forms')
else:
    print('SKIP cart mutations: connected real store')
print('HTTP smoke checks passed. Browser interaction and real-store OAuth remain separate checks.')
