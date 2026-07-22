'use strict';

const API_ROOT = 'https://api.github.com';

class GitHubClient {
  constructor({ token, fetchImpl = globalThis.fetch, apiRoot = API_ROOT } = {}) {
    if (!fetchImpl) throw new Error('This program requires Node.js 20 or newer.');
    this.token = token;
    this.fetch = fetchImpl;
    this.apiRoot = apiRoot.replace(/\/$/, '');
  }

  async request(path) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'repo-growth-action'
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await this.fetch(`${this.apiRoot}${path}`, { headers });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub API ${response.status} for ${path}: ${body.slice(0, 240)}`);
    }
    return response.json();
  }

  async collect(repository) {
    validateRepository(repository);
    const repo = await this.request(`/repos/${repository}`);
    const releases = await this.paginate(`/repos/${repository}/releases?per_page=100`);
    const assets = [];

    for (const release of releases) {
      if (release.draft) continue;
      const releaseAssets = await this.paginate(
        `/repos/${repository}/releases/${release.id}/assets?per_page=100`
      );
      for (const asset of releaseAssets) {
        assets.push({
          id: String(asset.id),
          name: asset.name,
          release: release.tag_name,
          count: Number(asset.download_count) || 0
        });
      }
    }

    return {
      stars: Number(repo.stargazers_count) || 0,
      forks: Number(repo.forks_count) || 0,
      assets
    };
  }

  async paginate(path) {
    const separator = path.includes('?') ? '&' : '?';
    const base = path.replace(/([?&])page=\d+(&|$)/, '$1').replace(/[?&]$/, '');
    const items = [];
    for (let page = 1; ; page += 1) {
      const batch = await this.request(`${base}${separator}page=${page}`);
      if (!Array.isArray(batch)) throw new Error(`Expected a list from ${path}.`);
      items.push(...batch);
      if (batch.length < 100) return items;
    }
  }
}

function validateRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')) {
    throw new Error('Repository must use the owner/name format.');
  }
}

module.exports = { GitHubClient, validateRepository };
