# Eduskunta-vahti

A static, privacy-friendly Finnish civic dashboard. It combines Parliament data from **2 April 2023 onward** with the state budget since 2020, the official 2023 parliamentary election results, MPs' financial-interest and gift disclosures, and declared lobbying contacts in a searchable Finnish and Swedish interface, with English navigation, key guidance and budget controls.

The visual and information hierarchy is inspired by the public-facing `mijnkamer.be` service, but this repository contains an original implementation and visual system. The separate GitHub repository currently found at `GustaveCurtil/mijn_kamer` has no declared license, so none of its code or assets are included here. The live `mijnkamer.be` service appears to be a different implementation than that repository; this project only borrows its general civic-information structure.

## What is included

- Overview with current dataset totals and latest votes
- Vote list and vote detail, including party breakdowns
- MP list and MP detail with participation, party-line and speech statistics
- Locally hosted official Parliament portraits for every recorded MP, with source attribution
- Include/exclude checkboxes, search, date/value ranges and ascending/descending sorting throughout the Parliament and civic data views
- CSV and JSON export controls on tables, vote ballots and filtered result lists
- Policy-topic and official committee filters for votes and parliamentary matters
- Party comparison and party detail
- Speech browser with topic filters plus MP and party frequency/word-count analytics
- Parliamentary matter pages connecting matters, votes and amendments
- Plenary session index covering published votes and speeches, including sessions without roll-call votes
- State budget explorer for 2020 onward, with clickable treemaps, bar charts, ministry/chapter/moment drill-down, original/current budgets, actuals and year comparisons
- Parliamentary party programmes from Pohtiva’s 2023 election collection, with document type/language search, verified current representation and original source links
- Official 2023 parliamentary election results by party, district and elected candidate
- Searchable MP financial interests, outside income declarations, gift disclosures and lobbying contacts
- Original flat navigation with direct links to all eleven views, a compact mobile grid and a persistent FI / SV / EN selector
- Keyboard-accessible global search with a visible shortcut (`Ctrl/Cmd + K`)
- Ten-second data-loading deadline with retry, including stalled response bodies
- Budget navigation beside the results, always-readable item lists, plain-language hierarchy and reset controls
- Responsive layout, keyboard focus retention, named controls, screen-reader announcements, reduced-motion support and readable light/dark/high-contrast themes
- Automated browser interaction and axe accessibility checks
- Daily Parliament, budget, election, gift, lobbying and party-programme ingestion via GitHub Actions
- Free GitHub Pages deployment workflow
- Netlify configuration as an alternative
- Node's dependency-free test suite

## Data source and caveats

The Parliament importer uses the current structured API at `https://api.eduskunta.fi/api/v1`. It creates asynchronous yearly dataset exports for the `aanestys`, `puheenvuoro` and `valtiopaivaasia` categories, downloads the resulting NDJSON, fetches authoritative member records from `/kansanedustajat`, and publishes a static dataset. Finnish and Swedish matter titles, stages, document identifiers and agenda metadata are retained. Speech text is preserved in full and shown in the language in which Parliament publishes the transcript. This avoids thousands of legacy table requests and keeps the scheduled run bounded. The prior low-level table implementation is retained as `scripts/sync-data-legacy.mjs` for reference only.

The additional applications use these official sources:

- State Treasury's State Budget Finances API for annual and monthly budget figures
- Statistics Finland's PXWeb API for 2023 election votes, shares, turnout and elected candidates
- Parliament's open-data API for MPs' financial interests, outside income and gift disclosures
- FSD / Tampere University’s Pohtiva collection at https://www.fsd.tuni.fi/pohtiva/vaalit/6 for parliamentary party programmes
- The Finnish Transparency Register's public API for self-reported lobbying activities and targets

Lobbying entries are grouped by declaration topic in the interface while preserving all reported targets. A contact in this dataset means a contact declared by the reporting organisation; it is not an independently verified finding. Policy domains are broad keyword-based discovery tags, while committee filters use the official committee names associated with a matter by Parliament's API. Speech word totals are derived from published transcript text. Detailed budget classifications currently follow the source's Finnish terminology, while controls and top-level guidance are available in Finnish and Swedish. English covers navigation, key page guidance and budget controls; original records and some detailed controls retain their source language.

“Amendment” is a transparent heuristic: a vote is marked as an amendment when its Finnish title includes terms such as `ehdotus`, `vastalause` or `lausuma`. This is useful for discovery, but not a legal classification. Participation and party-line scores are descriptive and should not be interpreted as measures of political quality.

## Simple reading mode

The **Helppo näkymä / Enkel vy / Simple view** switch opens a separate, calmer presentation of the same local data. It offers question-led entry points, short explanations, searchable cards and smaller result pages for votes, MPs, speeches, proposals, the state budget, gifts and lobbying. Sessions, parties, programmes and election results remain available from the simple home page. Official vote alternatives, original titles, full speech transcripts, sources and snapshot dates remain available.

The switch preserves the current route and remembers the choice in this browser. Share the [simple site](https://savvyboi.github.io/vahtikissa/?view=simple#/overview) or the [detailed site](https://savvyboi.github.io/vahtikissa/?view=full#/overview); an explicit URL takes precedence over the remembered setting. Each simple page also offers a button for its detailed view. Interface guidance is available in Finnish, Swedish and English; official records keep their published language.

Route links and budget drill-downs preserve the current scroll position, within the available height of the destination. Back and Forward restore each history entry's saved position. Loading a dataset, changing filters, switching tabs and opening search do not force the reader to the top. The skip link and deliberate profile-section links still move to their requested content.

## Local development

Requires Node.js 22 or newer.

```bash
npm test
npm run sync
npm run sync:committees
npm run build:speech-analytics
npm run sync:civic:all
npm run sync:programmes
npm run dev
```

Open `http://localhost:4173`.

`npm run sync` can take several minutes because it downloads Parliament's yearly datasets and rebuilds the committee and speech-analysis indexes. The two narrower commands rebuild those derived files independently. `npm run sync:civic:all` rebuilds every budget year from 2020 and the election and influence snapshots. Scheduled civic runs refresh **all budget years**, elections and influence in independent steps. To run one source locally, use `npm run sync:civic -- --only=budget --all`, `--only=elections`, or `--only=influence`. Generated files are committed under `data/` so the public site has no server, database, secrets or runtime API dependency.

Browser checks use development-only Playwright and axe dependencies:

```bash
npm ci
npx playwright install chromium
npm run test:browser
```

On Windows with Microsoft Edge installed, use `$env:BROWSER_CHANNEL='msedge'` before the browser test instead of downloading Chromium. Checks cover the Finnish and Swedish data views, details, 320px layouts, light/dark/high-contrast themes, inclusion/exclusion behavior, sorting, pagination and keyboard focus. Automated checks help catch regressions; they do not replace usability testing with people who use assistive technology.

Official portraits come from the `https://www.eduskunta.fi/api/memberImages/{memberId}` endpoint used by Parliament's member directory. `npm run sync:portraits` downloads missing portraits and creates 240px WebP copies; `npm run sync:portraits -- --refresh` refreshes existing images as well. It uses the same Playwright browser setup as the browser checks. The daily Parliament sync also fetches portraits when new member IDs appear. Portrait attribution is shown on the member list and detail pages.

The ASCII logo and basket-cat character are sampled directly from the owner's two reference photos. The basket image uses 240 columns of ASCII characters, with colours and brightness sampled from a rectangular crop of `DSC_0001.jpg` that retains the basket, toys, cat's original pose and hanging paw. Contrast and exposure are adjusted for text rendering. No features or outlines are drawn by hand. The SVGs contain only ASCII text and a background; plain-text versions are included under `assets/`. The home-page thumbnail is rendered from the ASCII SVG to avoid text aliasing at small sizes; clicking it opens the detailed SVG. To regenerate the assets from the photos, run `node scripts/create-cat-ascii.mjs basket-photo.jpg face-photo.jpg` after setting up the browser checks.

Search, filter and sort panels start collapsed in both reading views. Open **Haku ja rajaukset / Sök och avgränsa / Search and filters** or **Rajaa ja järjestä / Avgränsa och sortera / Filter and sort** to reveal the controls; active-filter counts remain visible when closed. Panels stay open while editing and filtering. Inside the sorting panel, open **Sisällytä, sulje pois ja rajaa / Inkludera, uteslut och avgränsa** for multiple include/exclude selections and ranges. Selections within one group use OR, different groups use AND, and exclusions take precedence. Data exports follow the active filters and order.

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

- `.github/workflows/daily-sync.yml`: tests, downloads Parliament votes, full speeches, matters, members, sessions, committees and derived indexes daily at 02:17 UTC; validates before committing.
- `.github/workflows/daily-civic-sync.yml`: refreshes every budget year, elections, interests, gifts, lobbying and party programmes daily at 03:43 UTC. A source failure retains its last published snapshot while allowing other valid sources to update; the run reports failure so maintainers can investigate.
- Both scheduled writers share a concurrency group, use complete Git history and retry rebased pushes.
- `.github/workflows/pages.yml`: validates and publishes the latest `main`, including valid updates committed by bot workflows. This explicit `workflow_run` trigger is needed because bot-token pushes do not start ordinary push workflows.
- `.github/workflows/browser-check.yml`: browser and accessibility regression checks on code changes.
- `EDUSKUNTA_API` can override the API base URL for testing.
- If the upstream API fails, the sync exits non-zero and does not replace the last valid dataset.

Schedules are requested times, not guaranteed delivery times. GitHub can delay scheduled runs, and public-repository schedules are disabled after 60 days without activity; see [GitHub's schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Check the Actions tab after prolonged inactivity and re-enable workflows if needed. All refresh workflows also support manual execution. Source publication delays can mean there is no new data even after a successful daily refresh. The home, vote, speech and session pages show the last refresh separately from the latest recorded vote and speech dates. Session coverage is the union of published votes and speeches; sessions without either record are not inferred. Session details load only their own speech metadata. Validation rejects snapshots that omit a speech or vote from the session index.

## License

Application code: MIT. Parliament data remains subject to the source provider's terms and attribution requirements. The interface states that this is not an official Parliament service.

## Budget and programme methods

The budget view uses the treemap and bar-chart interactions demonstrated in the Ministry of Finance’s Tutki budjettia video. Areas show monetary proportions; original and current budgets are distinct. Revenue excludes budget section 15 (borrowing) when calculating the deficit. Actuals show their source month, and percentage comparisons of actuals are suppressed if the years cover different numbers of months. Small chart blocks have equivalent, readable links in the complete table.

Pohtiva documents are linked in their original language, with publication year and programme type. The page deliberately represents the requested **2023 election collection**, not a claim to each party’s newest programme. Representation and group seat counts are checked against Parliament’s current member reference list every day. Independent groups without matching documents in that collection are excluded.

Parliament’s bulk member endpoint currently stops at 1,000 historical records. The importers supplement it with individual records for every active MP and every MP in the tracked period. Any failed supplement stops that source from replacing its previous snapshot.

## Speech vocabulary and research

Every MP profile has a speech word cloud, including an explicit empty state when no vocabulary meets the thresholds. The daily Parliament sync and `npm run build:speech-analytics` regenerate `data/speech-wordclouds.json` from full transcripts. Finnish and Swedish function words, conversational fillers, parliamentary boilerplate, recorded MP surnames (including simple inflections) and bracketed editorial notes are excluded. Hyphenated compounds remain intact, while dangling prefixes such as “ulko-” are omitted. Tokens shorter than three letters are omitted except EU/YK/FN. The versioned list combines Snowball stopwords (BSD-3-Clause; see `THIRD_PARTY_NOTICES.md`) with curated additions in `speech-research.js`.

Clouds rank words by `sqrt(occurrences) * log2(relative frequency) * specificity`. Relative frequency compares `(MP occurrences + 0.5) / (MP filtered words + 1)` with the same rate among other MPs and must be at least 1.5. Specificity is `log2(1 + corpus speakers / speakers using this word)`, a factor that favours vocabulary used by fewer MPs. With no reference words, the score falls back to `sqrt(occurrences)`. At five or more speeches, a word requires three occurrences in at least two speeches. At 20 or more speeches, it requires five occurrences in three speeches on three different dates, reducing single-debate artefacts. Only one of transparent suffix variants (e.g. Nato/Naton) is selected; this is not lemmatization, and counts are not merged. Exports retain exact counts, speech/day/speaker counts, relative frequencies and scores. Size reflects this ranking, not political importance. The sidebar shows 24 words initially and links each word to that MP’s exact-word transcript search. Language mix and corpus size affect comparisons.

The speech browser supports substring/stem, whole-word and contiguous exact-phrase searches; transcript-only or transcript-plus-metadata scope; an excluded word/phrase; MP, party, topic, speech-type and date filters; normalized keyword-in-context excerpts; and reusable search links that preserve filters and ordering. Case and punctuation are ignored, accents retained, and occurrences are non-overlapping. Context excerpts are explicitly normalized, while full-text downloads preserve the original published transcript.

The research summary and monthly CSV/JSON export use the same filtered corpus **before the positive query**, with the exclusion applied, as their denominator. Occurrences per 10,000 words use whitespace-separated tokens in the normalized search index (letters and numbers); these denominators differ from the letter-only vocabulary cloud. Metadata-only hits are listed but do not count as transcript occurrences. Monthly exports include corpus speech/word counts, matching speeches, occurrence counts, rates, query settings, all active filters and source-snapshot timestamp. Result CSV/JSON exports include every filtered result, its original full transcript, MP ID, recorded party at the time of the speech, documents, occurrence count and search settings. Topic tags remain heuristic discovery aids. The existing “who speaks most” ranking is explicitly labelled as the whole topic corpus.

## Official MP background information

`data/member-profiles.json` contains Parliament's published bilingual occupation, education, employment history, electoral district, municipality, birth year/place, parliamentary service and interruptions, dated committee roles, other body/ministerial histories and published email/phone. Both the public MP page and exact official API record are linked, with retrieval date. Current committee lists use start/end dates at retrieval; full histories retain ended appointments and substitute roles. Missing source values are labelled as unpublished. A published occupation or historical employment entry is not presented as verified current employment.

The regular Parliament importer reuses its authoritative member records to refresh profiles daily, supplementing the truncated bulk endpoint as before. To refresh profiles independently, run `npm run sync:profiles`. Missing requested official records fail the import before overwriting the published profile snapshot.

The budget's back control sits immediately above the visualization. The adjacent scrollable list exposes full names, codes, amounts and shares without hover, with equivalent drill-down links for tiny and non-positive chart entries.

### Profile contacts and budget navigation

The profile view separates published background information, current committee/body/ministerial roles, personal contacts and dated histories. Missing qualifications or work history are described as unpublished, and interrupted parliamentary service is shown explicitly. Whitespace and a stray slash before a closing parenthesis are cleaned without rewriting factual source content.

`npm run sync:contacts` refreshes `data/member-contacts.json` from the official directory’s structured page data for current MPs. Assistant names, email and published office/mobile numbers are displayed with their own source link and retrieval date. Personal phone numbers are never inferred from an assistant’s number. A failed directory request leaves the previous complete contact snapshot intact; the daily workflow continues other updates and reports the contact failure.

The budget supports whole-year search across ministries, chapters and moments, including dotted codes such as 33.10.54, plus a current-level search option. Search results preserve their full drill-down paths and ancestor names; overlapping levels are not summed. Map, bar and table views share filtering and sorting. Exact euro amounts appear in the table and at the selected moment, alongside original/current/actual figures. Tables become labelled cards on phones, while breadcrumbs and a back link retain the browsing context. Year comparisons retain monetary amounts in charts and show percentage changes separately; missing prior-year items and incompatible actual periods have no percentage comparison.

Release checks also cover malformed links, blocked browser storage, collapsed filter panels and spreadsheet-safe CSV exports. Run `npm run test:release` for the focused browser regression audit. CSV text that could be interpreted as a formula is prefixed with an apostrophe; numeric amounts and JSON exports retain their original values.

## Browser performance

`npm run build:data` derives a small Parliament entry point and separate vote, MP, speech and legislation payloads from the validated source snapshot. The development server prepares these automatically; GitHub Pages and Netlify prepare them during deployment. Generated `data/parliament/` files are ignored by Git and must be rebuilt after a snapshot changes. Other static hosts should run `npm run check && npm run build:data` before publishing the repository root.

The home page and ordinary vote/MP lists avoid downloading or expanding the complete ballot and speech collections. A vote detail loads only its ballots and related matters; an MP detail loads only that MP’s ballots and speech metadata. The simple vote list uses precomputed party totals. Reading modes and civic modules load when used. Full speech metadata and the full-text search index are requested only when their views or search need them. Original snapshots, transcripts and exports remain complete.

A small back-to-top arrow appears after scrolling down. It works in both reading views, has Finnish/Swedish/English labels, supports keyboard input and respects reduced-motion preferences.

Run `npm run test:performance` for browser payload budgets, scoped-detail loading and back-to-top interaction checks on desktop and mobile.
