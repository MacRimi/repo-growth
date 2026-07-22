'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GitHubClient, validateRepository } = require('../src/github');

test('collects public counters and release asset downloads', async () => {
  const responses = new Map([
    ['/repos/owner/repo', { stargazers_count: 42, forks_count: 7 }],
    ['/repos/owner/repo/releases?per_page=100&page=1', [{ id: 10, tag_name: 'v1', draft: false }, { id: 11, tag_name: 'next', draft: true }]],
    ['/repos/owner/repo/releases/10/assets?per_page=100&page=1', [{ id: 99, name: 'tool.zip', download_count: 123 }]]
  ]);
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    const pathname = url.replace('https://api.github.test', '');
    const body = responses.get(pathname);
    return { ok: body !== undefined, status: body === undefined ? 404 : 200, json: async () => body, text: async () => 'missing' };
  };
  const client = new GitHubClient({ token: 'test-token', fetchImpl, apiRoot: 'https://api.github.test' });

  assert.deepEqual(await client.collect('owner/repo'), {
    stars: 42,
    forks: 7,
    assets: [{ id: '99', name: 'tool.zip', release: 'v1', count: 123 }]
  });
});

test('collects timestamped stars and forks for the initial backfill', async () => {
  const responses = new Map([
    ['/repos/owner/repo/stargazers?per_page=100&page=1', [{ starred_at: '2026-01-01T10:00:00Z' }]],
    ['/repos/owner/repo/forks?per_page=100&page=1', [{ created_at: '2026-02-01T10:00:00Z' }]]
  ]);
  const fetchImpl = async (url, options) => {
    const pathname = url.replace('https://api.github.test', '');
    if (pathname.includes('/stargazers')) assert.equal(options.headers.Accept, 'application/vnd.github.star+json');
    const body = responses.get(pathname);
    return { ok: body !== undefined, status: body === undefined ? 404 : 200, json: async () => body, text: async () => 'missing' };
  };
  const client = new GitHubClient({ token: 'test-token', fetchImpl, apiRoot: 'https://api.github.test' });
  assert.deepEqual(await client.collectHistorical('owner/repo'), {
    stars: ['2026-01-01T10:00:00Z'],
    forks: ['2026-02-01T10:00:00Z']
  });
});

test('validates repository names', () => {
  assert.doesNotThrow(() => validateRepository('MacRimi/ProxMenux'));
  assert.throws(() => validateRepository('not a repository'), /owner\/name/);
});
