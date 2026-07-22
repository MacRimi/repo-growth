'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistory, normalizeHistory, recordSnapshot } = require('../src/history');

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

test('rejects a history file belonging to another repository', () => {
  assert.throws(() => normalizeHistory({ version: 1, repository: 'a/b' }, 'c/d'), /belongs to a\/b/);
});
