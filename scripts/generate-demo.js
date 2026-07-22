'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { renderSvg } = require('../src/svg');

const points = Array.from({ length: 18 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 6, 5 + index)).toISOString().slice(0, 10),
  stars: 1840 + index * 28 + Math.round(index ** 1.45 * 3),
  forks: 236 + index * 4 + Math.round(index / 3),
  downloads: 28400 + index * 970 + Math.round(index ** 1.35 * 120)
}));
const output = path.resolve('assets/repo-growth-demo.svg');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, renderSvg({
  repository: 'MacRimi/ProxMenux',
  title: 'Project growth',
  points,
  updatedAt: '2026-07-22T08:00:00Z'
}));
console.log(`Generated ${output}`);
