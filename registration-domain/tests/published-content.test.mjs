import assert from 'node:assert/strict';
import {test} from 'node:test';
import {matchesPublishedContent} from '../published-content.mjs';
import {canonicalSource} from '../build.mjs';

const source = canonicalSource();
const edge = source.replace('<!--email_off-->', '').replace('<!--/email_off-->', '');

test('accepts exact source and only the explicit root-page delivery variant', () => {
  assert.notEqual(edge, source);
  assert.equal(matchesPublishedContent(source, source), true);
  assert.equal(matchesPublishedContent(source, source, true), true);
  assert.equal(matchesPublishedContent(edge, source, true), true);
  assert.equal(matchesPublishedContent(edge, source), false, 'Other URLs and assets stay byte-exact');
});

test('rejects changed form destination, required fields, return URL, email and scripts', () => {
  for (const changed of [
    edge.replace('formsubmit.co', 'wrong.example'),
    edge.replace('name="attachment"', 'name="wrong"'),
    edge.replace('value="true"', 'value="false"'),
    edge.replace('?submitted=1', '?submitted=0'),
    edge.replace('<span>blanchettemr@gmail.com</span>', '<span>wrong@example.com</span>'),
    edge.replace('</body>', '<script src="https://wrong.example/injected.js"></script></body>'),
    edge.replace('register.js?v=', 'wrong.js?v='),
    edge.replace('register.css?v=', 'wrong.css?v='),
    edge + '\n',
  ]) {
    assert.notEqual(changed, edge, 'The negative fixture must change real content');
    assert.equal(matchesPublishedContent(changed, source, true), false);
  }
});

test('rejects the previous Cloudflare email rewrite and decoder injection', () => {
  const rewritten = edge.replace('<span>blanchettemr@gmail.com</span>',
    '<span><a class="__cf_email__" data-cfemail="00">[email protected]</a></span>')
    .replace('</body>', '<script src="/cdn-cgi/scripts/email-decode.min.js"></script></body>');
  assert.equal(matchesPublishedContent(rewritten, source, true), false);
});

test('does not discard arbitrary comments, broad exemptions or partial wrappers', () => {
  for (const changed of [source.replace('<!--email_off-->', ''),
    source.replace('<!--/email_off-->', ''), edge.replace('<body', '<!--email_off--><body'),
    edge.replace('</body>', '<!--unexpected--></body>')]) {
    assert.equal(matchesPublishedContent(changed, source, true), false);
  }
  assert.equal(matchesPublishedContent('different', 'unchanged', true), false);
});
