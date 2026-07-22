'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { GitHubClient, validateRepository } = require('./github');
const { createHistory, normalizeHistory, recordSnapshot, backfillHistory } = require('./history');
const { renderSvg } = require('./svg');

async function main(argv = process.argv.slice(2), environment = process.env) {
  const options = resolveOptions(argv, environment);
  validateRepository(options.repository);
  const previousText = readOptional(options.history);
  const previous = previousText ? normalizeHistory(JSON.parse(previousText), options.repository) : createHistory(options.repository);
  const client = new GitHubClient({ token: options.token });
  const snapshot = await client.collect(options.repository);
  let history = recordSnapshot(previous, snapshot);
  if (options.backfill && !history.backfilledAt) {
    try {
      const historical = await client.collectHistorical(options.repository);
      history = backfillHistory(history, historical);
      console.log(`Repo Growth: reconstructed ${historical.stars.length} stars and ${historical.forks.length} forks.`);
    } catch (error) {
      console.warn(`::warning::Historical backfill skipped: ${error.message}`);
    }
  }
  const historyText = `${JSON.stringify(history, null, 2)}\n`;
  const historyChanged = writeIfChanged(options.history, historyText);
  const renderTargets = buildRenderTargets(options);
  const outputChanged = renderTargets.map((target) => writeIfChanged(target.filename, renderSvg({
    repository: options.repository,
    title: target.title,
    points: history.points,
    updatedAt: history.updatedAt,
    metrics: target.metrics
  }))).some(Boolean);
  const changed = historyChanged || outputChanged;

  if (changed && options.commit) commitFiles([options.history, ...renderTargets.map((target) => target.filename)], options.commitMessage);
  setOutputs(environment, { changed, stars: snapshot.stars, forks: snapshot.forks, downloads: history.totals.downloads });
  console.log(`Repo Growth: ${snapshot.stars} stars, ${snapshot.forks} forks, ${history.totals.downloads} downloads.`);
  console.log(changed ? `Updated ${renderTargets.map((target) => target.filename).join(', ')} and ${options.history}.` : 'Everything is already up to date.');
  return { changed, snapshot, history };
}

function resolveOptions(argv, env) {
  const args = parseArgs(argv);
  const isAction = env.GITHUB_ACTIONS === 'true';
  return {
    repository: args.repository || env.INPUT_REPOSITORY || env.GITHUB_REPOSITORY,
    token: args.token || env.INPUT_TOKEN || env.GITHUB_TOKEN || '',
    output: path.resolve(args.output || env.INPUT_OUTPUT || 'assets/repo-growth.svg'),
    history: path.resolve(args.history || env.INPUT_HISTORY || '.github/repo-growth/history.json'),
    title: args.title || env.INPUT_TITLE || 'Project growth',
    metrics: parseMetrics(args.metrics || env.INPUT_METRICS || 'stars,forks,downloads'),
    layout: parseLayout(args.layout || env.INPUT_LAYOUT || 'dashboard'),
    backfill: parseBoolean(args.backfill ?? env.INPUT_BACKFILL ?? 'false', 'backfill'),
    commit: args.commit === true || (args.commit !== false && isAction && (env.INPUT_COMMIT || 'true').toLowerCase() === 'true'),
    commitMessage: args.commitMessage || env['INPUT_COMMIT-MESSAGE'] || 'chore: update repository growth [skip ci]'
  };
}

function parseArgs(argv) {
  const result = {};
  const keys = { '--repo': 'repository', '--token': 'token', '--output': 'output', '--history': 'history', '--title': 'title', '--metrics': 'metrics', '--layout': 'layout', '--commit-message': 'commitMessage' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--commit') result.commit = true;
    else if (argument === '--no-commit') result.commit = false;
    else if (argument === '--backfill') result.backfill = true;
    else if (argument === '--no-backfill') result.backfill = false;
    else if (keys[argument]) {
      if (!argv[index + 1]) throw new Error(`${argument} requires a value.`);
      result[keys[argument]] = argv[++index];
    } else if (argument === '--help' || argument === '-h') {
      console.log('Usage: repo-growth --repo owner/name [--metrics list] [--layout dashboard|separate|both] [--output file] [--commit]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return result;
}

function parseBoolean(value, name) {
  if (value === true || String(value).toLowerCase() === 'true') return true;
  if (value === false || String(value).toLowerCase() === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function parseMetrics(value) {
  const metrics = [...new Set(String(value).split(',').map((metric) => metric.trim().toLowerCase()).filter(Boolean))];
  const allowed = new Set(['stars', 'forks', 'downloads']);
  if (metrics.length === 0) throw new Error('At least one metric must be selected.');
  const unknown = metrics.filter((metric) => !allowed.has(metric));
  if (unknown.length) throw new Error(`Unknown metrics: ${unknown.join(', ')}.`);
  return metrics;
}

function parseLayout(value) {
  const layout = String(value).trim().toLowerCase();
  if (!['dashboard', 'separate', 'both'].includes(layout)) {
    throw new Error('Layout must be dashboard, separate, or both.');
  }
  return layout;
}

function buildRenderTargets(options) {
  const targets = [];
  if (options.layout !== 'separate') {
    targets.push({ filename: options.output, metrics: options.metrics, title: options.title });
  }
  if (options.layout !== 'dashboard') {
    for (const metric of options.metrics) {
      targets.push({
        filename: withMetricSuffix(options.output, metric),
        metrics: [metric],
        title: `${options.title} · ${metric[0].toUpperCase()}${metric.slice(1)}`
      });
    }
  }
  return targets;
}

function withMetricSuffix(filename, metric) {
  const extension = path.extname(filename) || '.svg';
  const basename = extension === path.extname(filename) ? filename.slice(0, -extension.length) : filename;
  return `${basename}-${metric}${extension}`;
}

function readOptional(filename) {
  try { return fs.readFileSync(filename, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

function writeIfChanged(filename, content) {
  if (readOptional(filename) === content) return false;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, filename);
  return true;
}

function commitFiles(files, message) {
  execFileSync('git', ['config', 'user.name', 'github-actions[bot]']);
  execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  execFileSync('git', ['add', '--', ...files], { stdio: 'inherit' });
  try {
    execFileSync('git', ['diff', '--cached', '--quiet']);
  } catch (error) {
    if (error.status !== 1) throw error;
    execFileSync('git', ['commit', '-m', message], { stdio: 'inherit' });
    execFileSync('git', ['push'], { stdio: 'inherit' });
  }
}

function setOutputs(env, values) {
  if (!env.GITHUB_OUTPUT) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.appendFileSync(env.GITHUB_OUTPUT, `${lines}\n`);
}

module.exports = { main, parseArgs, resolveOptions, parseMetrics, parseLayout, parseBoolean, buildRenderTargets, withMetricSuffix, writeIfChanged };
