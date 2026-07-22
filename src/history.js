'use strict';

const EMPTY_HISTORY = Object.freeze({
  version: 1,
  repository: '',
  updatedAt: '',
  backfilledAt: '',
  totals: { downloads: 0 },
  assets: {},
  points: []
});

function createHistory(repository) {
  return {
    version: EMPTY_HISTORY.version,
    repository,
    updatedAt: '',
    backfilledAt: '',
    totals: { downloads: 0 },
    assets: {},
    points: []
  };
}

function backfillHistory(historyValue, events, now = new Date()) {
  const history = structuredClone(historyValue);
  if (history.backfilledAt) return history;
  const today = now.toISOString().slice(0, 10);
  const starsByDate = countDates(events.stars, today);
  const forksByDate = countDates(events.forks, today);
  const dates = [...new Set([...starsByDate.keys(), ...forksByDate.keys()])].sort();
  let stars = 0;
  let forks = 0;
  const reconstructed = dates.map((date) => {
    stars += starsByDate.get(date) || 0;
    forks += forksByDate.get(date) || 0;
    return { date, stars, forks, downloads: null };
  });
  const merged = new Map(reconstructed.map((point) => [point.date, point]));
  for (const point of history.points) merged.set(point.date, point);
  history.points = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  history.backfilledAt = now.toISOString();
  history.updatedAt = now.toISOString();
  return history;
}

function countDates(timestamps, maximumDate) {
  const counts = new Map();
  for (const timestamp of Array.isArray(timestamps) ? timestamps : []) {
    const date = String(timestamp).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > maximumDate) continue;
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  return counts;
}

function normalizeHistory(value, repository) {
  if (!value || typeof value !== 'object') return createHistory(repository);
  if (value.version !== 1) throw new Error(`Unsupported history version: ${value.version}`);
  if (value.repository && value.repository !== repository) {
    throw new Error(`History belongs to ${value.repository}, not ${repository}.`);
  }
  return {
    ...createHistory(repository),
    ...value,
    repository,
    totals: { downloads: Number(value.totals?.downloads) || 0 },
    assets: value.assets && typeof value.assets === 'object' ? value.assets : {},
    points: Array.isArray(value.points) ? value.points : []
  };
}

function recordSnapshot(historyValue, snapshot, now = new Date()) {
  const history = structuredClone(historyValue);
  const previousState = JSON.stringify({ totals: history.totals, assets: history.assets, points: history.points });
  const seen = new Set();

  for (const asset of snapshot.assets) {
    seen.add(asset.id);
    const previous = history.assets[asset.id];
    if (!previous) {
      history.totals.downloads += asset.count;
    } else if (asset.count > previous.lastSeen) {
      history.totals.downloads += asset.count - previous.lastSeen;
    }
    history.assets[asset.id] = {
      name: asset.name,
      release: asset.release,
      lastSeen: asset.count,
      maximumSeen: Math.max(asset.count, Number(previous?.maximumSeen) || 0),
      active: true
    };
  }

  for (const [id, asset] of Object.entries(history.assets)) {
    if (!seen.has(id)) asset.active = false;
  }

  const date = now.toISOString().slice(0, 10);
  const point = {
    date,
    stars: snapshot.stars,
    forks: snapshot.forks,
    downloads: history.totals.downloads
  };
  const existing = history.points.findIndex((item) => item.date === date);
  if (existing >= 0) history.points[existing] = point;
  else history.points.push(point);
  history.points.sort((a, b) => a.date.localeCompare(b.date));
  const nextState = JSON.stringify({ totals: history.totals, assets: history.assets, points: history.points });
  if (nextState !== previousState) history.updatedAt = now.toISOString();
  return history;
}

module.exports = { createHistory, normalizeHistory, recordSnapshot, backfillHistory };
