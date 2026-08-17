'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistory, normalizeHistory, recordSnapshot, backfillHistory } = require('../src/history');

test('records one point per UTC day and accumulates asset download deltas', () => {
  let history = createHistory('MacRimi/ProxMenux');
  history = recordSnapshot(history, {
    stars: 10,
    forks: 2,
    assets: [{ id: '1', name: 'app.zip', release: 'v1', count: 100 }]
  }, new Date('2026-07-22T08:00:00Z'));
  history = recordSnapshot(history, {
    stars: 11,
    forks: 2,
    assets: [{ id: '1', name: 'app.zip', release: 'v1', count: 107 }]
  }, new Date('2026-07-22T18:00:00Z'));

  assert.equal(history.points.length, 1);
  assert.deepEqual(history.points[0], { date: '2026-07-22', stars: 11, forks: 2, downloads: 107 });
  assert.equal(history.totals.downloads, 107);
});

test('preserves downloads when an asset is deleted and counts a replacement', () => {
  let history = createHistory('owner/repo');
  history = recordSnapshot(history, {
    stars: 1, forks: 0, assets: [{ id: 'old', name: 'tool', release: 'v1', count: 25 }]
  }, new Date('2026-07-21T00:00:00Z'));
  history = recordSnapshot(history, {
    stars: 2, forks: 1, assets: [{ id: 'new', name: 'tool', release: 'v1', count: 4 }]
  }, new Date('2026-07-22T00:00:00Z'));

  assert.equal(history.totals.downloads, 29);
  assert.equal(history.assets.old.active, false);
  assert.equal(history.assets.new.active, true);
});

test('reconstructs cumulative star and fork history without inventing download history', () => {
  let history = createHistory('owner/repo');
  history = recordSnapshot(history, {
    stars: 3, forks: 2, assets: [{ id: '1', name: 'tool', release: 'v1', count: 50 }]
  }, new Date('2026-07-22T08:00:00Z'));
  history = backfillHistory(history, {
    stars: ['2026-01-01T10:00:00Z', '2026-01-01T12:00:00Z', '2026-03-01T10:00:00Z'],
    forks: ['2026-02-01T10:00:00Z', '2026-04-01T10:00:00Z']
  }, new Date('2026-07-22T09:00:00Z'));

  assert.deepEqual(history.points, [
    { date: '2026-01-01', stars: 2, forks: 0, downloads: null },
    { date: '2026-02-01', stars: 2, forks: 1, downloads: null },
    { date: '2026-03-01', stars: 3, forks: 1, downloads: null },
    { date: '2026-04-01', stars: 3, forks: 2, downloads: null },
    { date: '2026-07-22', stars: 3, forks: 2, downloads: 50 }
  ]);
  assert.equal(history.backfilledAt, '2026-07-22T09:00:00.000Z');
});

test('rejects a history file belonging to another repository', () => {
  assert.throws(() => normalizeHistory({ version: 1, repository: 'a/b' }, 'c/d'), /belongs to a\/b/);
});

test('merges overlapping clone windows by UTC date without double counting', () => {
  let history = createHistory('owner/repo');
  history = recordSnapshot(history, {
    stars: 10,
    forks: 2,
    assets: [],
    clones: [
      { date: '2026-08-14', count: 4, uniques: 3 },
      { date: '2026-08-15', count: 10, uniques: 9 }
    ]
  }, new Date('2026-08-15T04:00:00Z'));
  history = recordSnapshot(history, {
    stars: 11,
    forks: 2,
    assets: [],
    clones: [
      { date: '2026-08-14', count: 4, uniques: 3 },
      { date: '2026-08-15', count: 12, uniques: 10 },
      { date: '2026-08-16', count: 5, uniques: 4 }
    ]
  }, new Date('2026-08-16T04:00:00Z'));

  assert.equal(history.totals.clones, 21);
  assert.deepEqual(history.traffic.cloneDays['2026-08-15'], { count: 12, uniques: 10 });
  assert.deepEqual(history.points.map(({ date, clones }) => ({ date, clones })), [
    { date: '2026-08-14', clones: 4 },
    { date: '2026-08-15', clones: 16 },
    { date: '2026-08-16', clones: 21 }
  ]);
});

test('normalizes older histories without clone traffic', () => {
  const history = normalizeHistory({
    version: 1,
    repository: 'owner/repo',
    totals: { downloads: 7 },
    points: [{ date: '2026-08-01', stars: 1, forks: 0, downloads: 7 }]
  }, 'owner/repo');

  assert.deepEqual(history.totals, { downloads: 7, clones: 0 });
  assert.deepEqual(history.traffic, { cloneDays: {} });
});

test('preserves release asset state when downloads are not collected', () => {
  let history = createHistory('owner/repo');
  history = recordSnapshot(history, {
    stars: 1,
    forks: 0,
    assets: [{ id: '1', name: 'tool', release: 'v1', count: 25 }]
  }, new Date('2026-08-14T00:00:00Z'));
  history = recordSnapshot(history, {
    stars: 2,
    forks: 0,
    assets: null
  }, new Date('2026-08-15T00:00:00Z'));

  assert.equal(history.totals.downloads, 25);
  assert.equal(history.assets['1'].active, true);
});
