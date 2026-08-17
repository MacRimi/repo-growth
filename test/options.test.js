'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { main, buildRenderTargets, parseLayout, parseMetrics, parseBoolean, resolveOptions, withMetricSuffix } = require('../src/index');

test('parses and validates selected metrics and layout', () => {
  assert.deepEqual(parseMetrics('stars, downloads,clones,stars'), ['stars', 'downloads', 'clones']);
  assert.equal(parseLayout('BOTH'), 'both');
  assert.throws(() => parseMetrics('stars,views'), /Unknown metrics/);
  assert.throws(() => parseLayout('tiles'), /dashboard, separate, or both/);
  assert.equal(parseBoolean('true', 'backfill'), true);
  assert.equal(parseBoolean(false, 'backfill'), false);
  assert.throws(() => parseBoolean('sometimes', 'backfill'), /true or false/);
});

test('resolves the dedicated traffic token without replacing the normal token', () => {
  const options = resolveOptions([], {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_TOKEN: 'automatic-token',
    'INPUT_TRAFFIC-TOKEN': 'traffic-token',
    INPUT_METRICS: 'stars,clones'
  });

  assert.equal(options.token, 'automatic-token');
  assert.equal(options.trafficToken, 'traffic-token');
  assert.deepEqual(options.metrics, ['stars', 'clones']);
});

test('fails before making requests when clones is selected without a traffic token', async () => {
  await assert.rejects(
    () => main(['--repo', 'owner/repo', '--metrics', 'clones', '--no-commit'], {}),
    /clones metric requires traffic-token/
  );
});

test('builds dashboard and separate output filenames', () => {
  const output = path.resolve('assets/growth.svg');
  const targets = buildRenderTargets({
    output,
    metrics: ['stars', 'downloads'],
    layout: 'both',
    title: 'Project growth'
  });
  assert.deepEqual(targets.map((target) => path.basename(target.filename)), [
    'growth.svg',
    'growth-stars.svg',
    'growth-downloads.svg'
  ]);
  assert.equal(withMetricSuffix(path.resolve('growth'), 'forks'), path.resolve('growth-forks.svg'));
});
