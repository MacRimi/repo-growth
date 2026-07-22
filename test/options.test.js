'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildRenderTargets, parseLayout, parseMetrics, withMetricSuffix } = require('../src/index');

test('parses and validates selected metrics and layout', () => {
  assert.deepEqual(parseMetrics('stars, downloads,stars'), ['stars', 'downloads']);
  assert.equal(parseLayout('BOTH'), 'both');
  assert.throws(() => parseMetrics('stars,views'), /Unknown metrics/);
  assert.throws(() => parseLayout('tiles'), /dashboard, separate, or both/);
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
