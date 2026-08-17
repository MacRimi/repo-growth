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

test('collects the daily Git clone traffic window', async () => {
  const response = {
    count: 15,
    uniques: 13,
    clones: [
      { timestamp: '2026-08-14T00:00:00Z', count: 4, uniques: 3 },
      { timestamp: '2026-08-15T00:00:00Z', count: 11, uniques: 10 }
    ]
  };
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer traffic-token');
    assert.match(url, /\/repos\/owner\/repo\/traffic\/clones\?per=day$/);
    return { ok: true, status: 200, json: async () => response, text: async () => '' };
  };
  const client = new GitHubClient({ token: 'traffic-token', fetchImpl, apiRoot: 'https://api.github.test' });

  assert.deepEqual(await client.collectClones('owner/repo'), [
    { date: '2026-08-14', count: 4, uniques: 3 },
    { date: '2026-08-15', count: 11, uniques: 10 }
  ]);
});

test('skips release requests when downloads are not selected', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ stargazers_count: 42, forks_count: 7 }),
      text: async () => ''
    };
  };
  const client = new GitHubClient({ token: 'test-token', fetchImpl, apiRoot: 'https://api.github.test' });

  assert.deepEqual(await client.collect('owner/repo', { includeDownloads: false }), {
    stars: 42,
    forks: 7,
    assets: null
  });
  assert.deepEqual(requested, ['https://api.github.test/repos/owner/repo']);
});

test('validates repository names', () => {
  assert.doesNotThrow(() => validateRepository('MacRimi/ProxMenux'));
  assert.throws(() => validateRepository('not a repository'), /owner\/name/);
});
