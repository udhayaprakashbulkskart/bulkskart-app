import test from 'node:test';
import assert from 'node:assert/strict';
import { crawlDelaySeconds, isAllowed, parseRobots } from '../src/robots.mjs';

const T = 'bulkskartdiscoverybot';

test('the * group applies when no group names us', () => {
  const r = parseRobots('User-agent: *\nDisallow: /admin\nAllow: /admin/public\n');
  assert.equal(isAllowed(r, T, '/products/a'), true);
  assert.equal(isAllowed(r, T, '/admin/x'), false);
  assert.equal(isAllowed(r, T, '/admin/public/x'), true, 'longest match wins');
});

test('a group naming our bot replaces the * group', () => {
  const r = parseRobots('User-agent: *\nDisallow:\n\nUser-agent: BulkSkartDiscoveryBot\nDisallow: /\n');
  assert.equal(isAllowed(r, T, '/'), false);
  assert.equal(isAllowed(r, 'otherbot', '/'), true);
});

test('wildcards, end anchors and ties', () => {
  const r = parseRobots('User-agent: *\nDisallow: /*.pdf$\nDisallow: /search?\nAllow: /p\nDisallow: /p\n');
  assert.equal(isAllowed(r, T, '/files/a.pdf'), false);
  assert.equal(isAllowed(r, T, '/files/a.pdf?x=1'), true);
  assert.equal(isAllowed(r, T, '/search?q=x'), false);
  assert.equal(isAllowed(r, T, '/p'), true, 'allow wins a tie');
});

test('crawl-delay and grouped user-agents', () => {
  const r = parseRobots('User-agent: a\nUser-agent: *\nCrawl-delay: 4\nDisallow: /tmp\n');
  assert.equal(crawlDelaySeconds(r, T), 4);
  assert.equal(isAllowed(r, T, '/tmp/x'), false);
});
