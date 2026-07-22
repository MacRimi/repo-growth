<h1 align="center">Repo Growth</h1>

<p align="center">
  <strong>A modern, self-contained growth dashboard for GitHub repositories.</strong>
</p>

<p align="center">
  Track stars, forks, and release downloads from your own repository.<br>
  No personal access token. No external service. No hosted database.
</p>

<p align="center">
  <a href="https://github.com/MacRimi/repo-growth/actions/workflows/test.yml"><img src="https://github.com/MacRimi/repo-growth/actions/workflows/test.yml/badge.svg" alt="Tests"></a>
  &nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-18181b.svg" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#frequently-asked-questions">FAQ</a>
</p>

<p align="center">
  <a href="https://github.com/MacRimi/repo-growth">
    <img src="assets/repo-growth-demo.svg" alt="Repo Growth dashboard preview" width="900">
  </a>
  <br>
  <sub>Preview generated with example data. The dashboard adapts automatically to GitHub's light and dark themes.</sub>
</p>

## At a glance

| | |
| --- | --- |
| **Zero secret setup** | Uses the short-lived `github.token` already provided to every workflow. |
| **Optional historical import** | Can reconstruct currently available star and fork history once with collaborator credentials. |
| **Repository-owned data** | The complete history remains a readable JSON file in your repository. |
| **Static and dependable** | Your README displays a local SVG, with no API request at viewing time. |
| **Honest download totals** | Previously observed downloads survive deleted or replaced release assets. |
| **Balanced visualization** | Each metric has its own chart, so different scales remain legible. |
| **Modern by default** | Responsive sizing, accessible labels, and automatic light/dark appearance. |

## Quick start

Create `.github/workflows/repo-growth.yml` in the repository you want to track:

```yaml
name: Update repository growth

on:
  schedule:
    - cron: "17 4 * * *"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: repo-growth
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: MacRimi/repo-growth@v1
```

Run it once from the **Actions** tab. Repo Growth creates:

```text
assets/repo-growth.svg
.github/repo-growth/history.json
```

Add the dashboard to your README:

```html
<p align="center">
  <a href="https://github.com/MacRimi/repo-growth">
    <img src="assets/repo-growth.svg" alt="Project growth" width="900">
  </a>
</p>
```

That is all. The scheduled workflow records a new point each day and commits only when the generated content changes.

## How it works

```text
Scheduled GitHub Action
          │
          ▼
 GitHub REST API totals
   ├── Stars
   ├── Forks
   └── Release assets
          │
          ▼
 Persist history.json
          │
          ▼
 Generate adaptive SVG
          │
          ▼
 Commit changed files
```

Daily tracking uses the repository-scoped `github.token` and needs no custom secret. An optional one-time backfill can read timestamped stars and fork creation dates when supplied with an administrator or collaborator token.

> [!IMPORTANT]
> Existing stars and forks can be reconstructed, but deleted forks and removed stars are no longer present in GitHub's API. Release download history starts when Repo Growth is installed because GitHub does not expose timestamps for individual downloads.

## Why this approach?

GitHub restricted timestamped stargazer data in July 2026 to repository administrators and collaborators. Public services can no longer reconstruct a repository's star history anonymously.

Repo Growth's normal scheduled collection runs without a personal token or stored secret. GitHub's automatic Actions token is not treated as an administrator or collaborator for the restricted stargazer listing, so historical star backfill requires one-time collaborator credentials. README visitors receive an already-generated image; there is no external API call, tracking request, or expiring URL in the rendering path.

## Configuration

| Input | Default | Description |
| --- | --- | --- |
| `repository` | Current repository | Repository in `owner/name` format |
| `output` | `assets/repo-growth.svg` | Generated dashboard path |
| `history` | `.github/repo-growth/history.json` | Persistent data path |
| `backfill` | `false` | Reconstruct existing star and fork history once; requires an admin or collaborator token |
| `title` | `Project growth` | Heading displayed in the SVG |
| `metrics` | `stars,forks,downloads` | Metrics to display, in the desired order |
| `layout` | `dashboard` | Generate `dashboard`, `separate`, or `both` outputs |
| `commit` | `true` | Commit and push changed files |
| `commit-message` | `chore: update repository growth [skip ci]` | Automated commit message |
| `token` | `github.token` | Authentication token; no custom secret is normally needed |

For example:

```yaml
- uses: MacRimi/repo-growth@v1
  with:
    title: ProxMenux growth
    output: images/project-growth.svg
    metrics: stars,downloads
```

### Optional one-time historical import

GitHub requires the credential used for timestamped stargazers to belong to a repository administrator or collaborator. Create a fine-grained, read-only token limited to the target repository, save it temporarily as `REPO_GROWTH_BACKFILL_TOKEN`, and run:

```yaml
- uses: MacRimi/repo-growth@v1
  with:
    backfill: true
    token: ${{ secrets.REPO_GROWTH_BACKFILL_TOKEN }}
```

After the successful run, Repo Growth records `backfilledAt` in the history file and will not repeat the import. Remove the secret and the two inputs above; scheduled updates continue with the automatic `github.token`.

Alternatively, run the CLI once from a local environment already authenticated as an administrator or collaborator. The credential is used only for the API request and is never written to generated files.

### Choose the metrics

Display any metric or combination by separating their names with commas:

```yaml
- uses: MacRimi/repo-growth@v1
  with:
    metrics: stars,downloads
```

The combined dashboard adapts its height and card widths automatically. One metric uses the full canvas; two metrics share the available space.

### Generate individual charts

Use `layout: separate` when each metric should have its own image:

```yaml
- uses: MacRimi/repo-growth@v1
  with:
    metrics: stars,forks,downloads
    layout: separate
    output: assets/repo-growth.svg
```

This creates:

```text
assets/repo-growth-stars.svg
assets/repo-growth-forks.svg
assets/repo-growth-downloads.svg
```

Use `layout: both` to generate the combined dashboard and the selected individual charts in the same run.

## Understanding download totals

“Downloads” means files explicitly attached to GitHub Releases. It does not include:

- Repository clones
- Automatically generated source ZIP or TAR archives
- Container pulls
- Package-manager installations
- Files hosted outside GitHub Releases

GitHub exposes the current count of each release asset, but not its historical daily totals. Repo Growth stores the last observed count for every asset and accumulates only positive changes. If an asset disappears, the downloads already observed remain in the total.

## Frequently asked questions

<details>
<summary><strong>Does it require a PAT or repository secret?</strong></summary>

No for normal daily tracking. The default `github.token` reads repository totals and releases and commits the generated files. Historical star backfill is optional and requires a one-time administrator or collaborator token because of GitHub's July 2026 restriction.
</details>

<details>
<summary><strong>Does the README call an external service?</strong></summary>

No. It displays the SVG committed to the same repository. Repo Growth is not involved when somebody views the README.
</details>

<details>
<summary><strong>What history can the first run reconstruct?</strong></summary>

Repo Growth reconstructs currently existing stars from their `starred_at` timestamps and forks from their creation dates. Removed stars and deleted forks cannot be recovered. Release download history begins with the first run because GitHub only exposes current asset totals.

To request the import, set `backfill: true` and provide a token belonging to a repository administrator or collaborator. After the first successful import, the credential is no longer needed. You can also run the CLI once from an already authenticated local environment so no token is stored in the repository.
</details>

<details>
<summary><strong>What happens if the workflow runs twice in one day?</strong></summary>

The existing point for that UTC date is updated. Duplicate daily entries are not created.
</details>

<details>
<summary><strong>Can I change the schedule?</strong></summary>

Yes. Change the cron expression in your workflow. Daily execution is the recommended balance between detail and commit frequency.
</details>

## Run locally

Node.js 20 or newer is required:

```bash
node bin/repo-growth.js \
  --repo MacRimi/ProxMenux \
  --history .github/repo-growth/history.json \
  --output assets/repo-growth.svg
```

Set `GITHUB_TOKEN` if the unauthenticated API rate limit is insufficient. Local execution never commits unless `--commit` is supplied.

## Development

Repo Growth has no runtime dependencies:

```bash
npm test
npm run demo
```

The GitHub Action uses Node.js 24. Generated SVGs contain no JavaScript, remote fonts, or external stylesheets.

## Contributing and security

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and pull request guidelines.

Please report vulnerabilities privately by following the process in [SECURITY.md](SECURITY.md).

## License

Repo Growth is available under the [MIT License](LICENSE).
