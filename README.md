# Eduskunta-vahti

A static, privacy-friendly civic dashboard for Finnish Parliament open data from **2 April 2023 onward**. It groups roll-call votes, individual MP ballots, speeches, plenary sessions, parliamentary matters and amendment-like votes into a searchable Finnish interface.

The visual and information hierarchy is inspired by the public-facing `mijnkamer.be` service, but this repository contains an original implementation and visual system. The separate GitHub repository currently found at `GustaveCurtil/mijn_kamer` has no declared license, so none of its code or assets are included here. The live `mijnkamer.be` service appears to be a different implementation than that repository; this project only borrows its general civic-information structure.

## What is included

- Overview with current dataset totals and latest votes
- Vote list and vote detail, including party breakdowns
- MP list and MP detail with participation, party-line and speech statistics
- Party comparison and party detail
- Speech browser
- Parliamentary matter pages connecting matters, votes and amendments
- Plenary session index
- Keyboard-accessible global search (`Ctrl/Cmd + K`)
- Responsive layout and semantic HTML
- Daily, retrying data ingestion via GitHub Actions
- Free GitHub Pages deployment workflow
- Netlify configuration as an alternative
- Node's dependency-free test suite

## Data source and caveats

The importer uses Parliament's current structured API at `https://api.eduskunta.fi/api/v1`. It creates asynchronous yearly dataset exports for the `aanestys` and `puheenvuoro` categories, downloads the resulting NDJSON, fetches authoritative member records from `/kansanedustajat`, and publishes a reduced static dataset. This avoids thousands of legacy table requests and keeps the scheduled run bounded. The prior low-level table implementation is retained as `scripts/sync-data-legacy.mjs` for reference only.

“Amendment” is a transparent heuristic: a vote is marked as an amendment when its Finnish title includes terms such as `ehdotus`, `vastalause` or `lausuma`. This is useful for discovery, but not a legal classification. Participation and party-line scores are descriptive and should not be interpreted as measures of political quality.

## Local development

Requires Node.js 22 or newer.

```bash
npm test
npm run sync
npm run dev
```

Open `http://localhost:4173`.

`npm run sync` can take several minutes because it downloads an individual ballot table for each vote. The generated files are committed under `data/` so the public site has no server, database, secrets or runtime API dependency.

## Free deployment (recommended: GitHub Pages)

1. Create a new GitHub repository.
2. Push this directory to its `main` branch.
3. In **Settings → Pages**, choose **GitHub Actions** as the source.
4. Run **Actions → Daily Eduskunta data sync → Run workflow** once.
5. The Pages workflow publishes the site; the sync workflow runs daily at 02:17 UTC and commits changed JSON.

This is free for a public repository under normal GitHub Pages/Actions limits and is the simplest option because the scheduled updater and hosting live together.

### Netlify alternative

Import the repository in Netlify. `netlify.toml` publishes the repository root. Keep the GitHub daily-sync workflow enabled: whenever it commits fresh data, Netlify deploys again automatically. Netlify's free tier is convenient for custom domains and previews, but GitHub Pages avoids relying on a second provider.

### Cloudflare Pages alternative

Connect the repository, use no framework preset, leave the build command empty (or `npm run check`) and set the output directory to `/`. Keep the scheduled GitHub Action for data updates.

## Automation details

- `.github/workflows/daily-sync.yml`: tests, downloads fresh data, commits only when data changed.
- `.github/workflows/pages.yml`: checks and publishes every `main` update.
- `EDUSKUNTA_API` can override the API base URL for testing.
- If the upstream API fails, the sync exits non-zero and does not replace the last valid dataset.

## License

Application code: MIT. Parliament data remains subject to the source provider's terms and attribution requirements. The interface states that this is not an official Parliament service.
