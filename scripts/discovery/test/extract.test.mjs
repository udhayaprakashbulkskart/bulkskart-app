import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFacts, linksToFollow, looksLikeCompany, productFromPage, readPage } from '../src/extract.mjs';
import { categoryFor } from '../src/categories.mjs';
import { testGstin } from './helpers.mjs';

const G = testGstin('24AAACA1111A1Z');
const SITE = 'https://www.alpha.example/';

const home = readPage(`<html><head><title>Alpha Polymers Pvt. Ltd. | PP Woven Sacks</title>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Alpha Polymers Pvt. Ltd.","url":"https://www.alpha.example",
   "address":{"@type":"PostalAddress","streetAddress":"Plot 12, GIDC Phase 2","addressLocality":"Vapi","addressRegion":"Gujarat","postalCode":"396195"},"telephone":"+91-98250 00000"}</script>
  </head><body><nav><a href="/about-us">About Us</a> <a href="/contact">Contact</a> <a href="/products">Products</a> <a href="/blog/news">Blog</a> <a href="https://other.example/x">Partner</a></nav>
  <h1>Welcome</h1><footer>© 2025 Alpha Polymers Pvt. Ltd. All rights reserved.</footer></body></html>`, SITE);
const contact = readPage(`<html><body><h1>Contact Us</h1><p>Registered office: Plot 12, GIDC Phase 2, Vapi, Gujarat - 396195, India</p>
  <p>GSTIN: ${G}</p><p>Phone: 98250 00000</p><a href="mailto:sales@alpha.example">Email us</a></body></html>`, `${SITE}contact`);

test('company facts come from structured data first, with the page they came from', () => {
  const f = companyFacts([home, contact], SITE);
  assert.equal(f.name, 'Alpha Polymers Pvt. Ltd.');
  assert.equal(f.evidence.found.name.method, 'json-ld name');
  assert.equal(f.gstin, G);
  assert.equal(f.evidence.found.gstin.url, `${SITE}contact`);
  assert.equal(f.state, 'Gujarat');
  assert.equal(f.city, 'Vapi');
  assert.equal(f.pincode, '396195');
  assert.ok(f.phones.includes('+91 98250 00000'));
  assert.deepEqual(f.emails, ['sales@alpha.example']);
  assert.equal(looksLikeCompany(f), true);
});

test('without structured data: name from the copyright line, address from labelled text', () => {
  const page = readPage(`<html><head><title>Home</title></head><body><h1>Quality pumps</h1>
    <p>Factory address: Survey No. 44, Kalawad Road, Rajkot, Gujarat 360005</p>
    <footer>Copyright 2024 Delta Pumps Industries. All rights reserved.</footer></body></html>`, 'https://delta.example/');
  const f = companyFacts([page], 'https://delta.example/');
  assert.equal(f.name, 'Delta Pumps Industries');
  assert.equal(f.pincode, '360005');
  assert.equal(f.city, 'Rajkot');
  assert.equal(f.state, 'Gujarat');
  assert.equal(f.gstin, null, 'no GSTIN on the page: none is made up');
});

test('a page with no company details is not a company website', () => {
  const blog = readPage('<html><head><title>My thoughts on pumps</title></head><body><h1>Pumps</h1><p>Opinions only.</p></body></html>', 'https://blog.example/');
  assert.equal(looksLikeCompany(companyFacts([blog], 'https://blog.example/')), false);
});

test('only same-site about/contact and product links are followed', () => {
  const l = linksToFollow(home, SITE);
  assert.deepEqual(l.about.sort(), [`${SITE}about-us`, `${SITE}contact`]);
  assert.deepEqual(l.products, [`${SITE}products`]);
});

test('a product page with a specification table', () => {
  const p = productFromPage(readPage(`<html><head><meta property="og:image" content="/img/sack.jpg"></head><body>
    <h1>PP Woven Sack 50 kg</h1><p>Laminated polypropylene woven sacks for cement, fertiliser and food grains, printed up to 4 colours.</p>
    <table><tr><th>Size</th><td>60 x 90 cm</td></tr><tr><th>Fabric GSM</th><td>70 - 90</td></tr><tr><th>MOQ</th><td>10,000 pieces</td></tr></table></body></html>`, `${SITE}products/pp-woven-sack`));
  assert.equal(p.name, 'PP Woven Sack 50 kg');
  assert.deepEqual(p.specifications, { Size: '60 x 90 cm', 'Fabric GSM': '70 - 90', MOQ: '10,000 pieces' });
  assert.equal(p.moq_text, '10,000 pieces');
  assert.equal(p.price_text, null, 'no price on the page: none is made up');
  assert.equal(p.image_source_url, `${SITE}img/sack.jpg`);
  assert.equal(categoryFor(p.name, Object.values(p.specifications).join(' ')), 'packaging');
});

test('a product page with schema.org Product keeps the stated price word for word', () => {
  const p = productFromPage(readPage(`<html><body><script type="application/ld+json">{"@type":"Product","name":"Monoblock Pump 1 HP","sku":"MB-100",
    "description":"Self-priming monoblock pump for domestic water supply.","offers":{"@type":"Offer","price":"4850","priceCurrency":"INR"},"brand":{"name":"Delta"}}</script>
    <h1>Monoblock Pump</h1></body></html>`, 'https://delta.example/products/mb-100'));
  assert.equal(p.name, 'Monoblock Pump 1 HP');
  assert.equal(p.price_text, 'INR 4850');
  assert.equal(p.specifications.SKU, 'MB-100');
  assert.equal(p.manufacturer, 'Delta');
  assert.equal(categoryFor(p.name), 'machinery-industrial');
});

test('listing pages and generic headings are not products', () => {
  const links = Array.from({ length: 30 }, (_, i) => `<a href="/products/item-${i}">Item ${i}</a>`).join(' ');
  assert.equal(productFromPage(readPage(`<html><body><h1>Our Products</h1>${links}</body></html>`, `${SITE}products`)), null);
  assert.equal(productFromPage(readPage(`<html><body><h1>Range of bags</h1><p>Specification on request.</p>${links}</body></html>`, `${SITE}products/range`)), null);
  assert.equal(productFromPage(readPage('<html><body><h1>About our company</h1><p>Founded long ago.</p></body></html>', `${SITE}about-us`)), null);
});
