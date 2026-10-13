# Data and page audit — 13 October 2026

The latest recorded roll-call vote is **7 October 2026, 14:08:36 Finnish time** (2026-94-5). This is correct for the official data checked today. All 230 votes in Parliament's 2026 export are present, with no missing or extra IDs. All 8,908 published 2026 speeches are present; the latest is from 9 October. The daily Parliament and civic update workflows and Pages deployments had succeeded on both 12 and 13 October.

## Corrections

- The session index previously used only votes and omitted debate-only days. It now combines published votes and speeches: **434 sessions**, including **285 without roll-call votes**, rather than 149. The latest sessions are 96/2026 (9 October, 10 speeches, no votes), 95/2026 (8 October, 125 speeches, no votes) and 94/2026 (7 October, 85 speeches, five votes).
- Both reading views show session speeches and links to their transcripts. Session details fetch their own small payload instead of the entire speech collection.
- Home, vote, speech and session pages distinguish the last data check from the latest recorded vote and speech. They explain that not every plenary includes a vote and records depend on Parliament's publication.
- Validation now checks session membership and speech counts, collection totals and latest-record dates. Overnight debates retain their opening day.
- Navigation marks rendering as busy before asynchronous loads; an older render cannot mark a newer one ready, and freshness notices preserve the reader’s scroll position. Release checks wait for the requested route and reading view, fixing the previous CI timeout.
- Lobbying badges wrap within narrow cards on landscape phones and tablets.

## Data coverage checked

| Area | Published coverage at the audit |
| --- | --- |
| Parliament | 2,796 votes; 556,404 ballots; 40,040 speeches; 7,212 matters; 219 current/former recorded members |
| Budget | 2020–2026; current-year actuals through September 2026 |
| Election | Official 2023 results and all 200 elected candidates |
| Gifts and interests | 487 gifts; latest gift declaration 29 September 2026; 2,715 interest/income rows, including explicit empty declarations |
| Lobbying | 129,113 declared target contacts in 11,860 topics; latest declaration 12 October 2026 |
| Programmes | Pohtiva's labelled 2023 election collection for nine represented parties |
| Profiles and contacts | 219 sourced profiles; current directory contacts for 200 MPs |

The Parliament snapshot was reimported at 11:39 UTC on 13 October. Civic snapshots were refreshed by the successful scheduled job at 11:09 UTC. Historic election results and the labelled 2023 programme collection are intentionally historical. September actuals are the latest monthly budget data in the source; they are not October estimates.

## Verification

117 unit checks and generated-data validation pass. Release, payload/performance, chart accessibility and loading/language checks pass. Browser checks cover all top-level views, representative detail pages, both reading views, Finnish/Swedish/English, filters and exports, source links, mobile/desktop navigation, themes and accessibility.

Sources: [Parliament API](https://api.eduskunta.fi/), [latest vote record](https://api.eduskunta.fi/api/v1/taysistunnot/aanestykset/2026-94-5), [State Treasury monthly budget index](https://api.tutkihallintoa.fi/valtiontalous/v1/budjettitalousvuosikuukausi), [Statistics Finland](https://pxdata.stat.fi/PxWeb/pxweb/fi/StatFin/StatFin__evaa/), [Transparency Register](https://www.avoimuusrekisteri.fi/), [GitHub update and deployment history](https://github.com/Savvyboi/vahtikissa/actions).
