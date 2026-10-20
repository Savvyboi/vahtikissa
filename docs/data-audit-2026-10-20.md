# Data and page audit — 20 October 2026

The local Parliament snapshot was refreshed at **16:41 UTC on 20 October** from the official structured API. It adds **62 speeches**, **session 101/2026**, and **three new parliamentary matters** compared with the morning snapshot. It also refreshes existing matter records and rebuilds the full transcripts, speech search, analytics, committee indexes, MP profiles and browser payloads. No vote, speech, session or matter IDs were removed.

The latest recorded roll-call vote remains **16 October, 13:06 Finnish time**. The latest published speech in this export is **20 October, 16:36 Finnish time**. Today's plenary did not add a roll-call vote to the source export. Its official minutes still reported incomplete preparation during the audit, so later publication can add or revise transcripts. The site imports published structured records rather than inferring transcript text from webcast markers.

This audit prepared the refreshed snapshots and fixes for publication after approval. Production was checked separately: its morning Parliament snapshot and all derived payloads matched, and the scheduled Parliament/civic updates and Pages deployment had succeeded. The latest deployment observed was [20 October at 16:25 UTC](https://github.com/Savvyboi/vahtikissa/actions/runs/39457190224), before this manual refresh.

| Area | Verified local coverage |
| --- | --- |
| Votes | 2,800 votes and 557,200 ballots; all 234 published 2026 votes imported |
| Sessions | 439 sessions, including today's debate-only session 101/2026 with 62 published speeches |
| Speeches | 40,501 complete transcripts; all 9,369 records in the 2026 source export imported |
| Matters | 7,533 matters; three new entries and 141 existing entries refreshed |
| Members | 219 current/former profiles; official directory contacts rechecked for all 200 current MPs, with 192 assistant entries |
| Budget | All years 2020–2026 reimported; September is still the latest official monthly data |
| Elections | Official 2023 results, 23 parties, 13 constituencies and all 200 elected candidates |
| Gifts and interests | 487 gifts, latest declaration 29 September; 2,715 interest/income rows, including explicit empty declarations |
| Lobbying | 129,114 declared target contacts in 11,861 topics from 839 organisations; latest declaration 15 October |
| Programmes | Pohtiva's labelled 2023 election collection: nine represented parties, 27 documents; 200 current MPs checked |

The independent lobbying comparison covered all five closed reporting periods and 5,824 official declarations. Target-contact, topic and organisation counts match the source exactly. January–June 2026 is the latest closed period; July–December 2026 remains a draft reporting period. The historical election and programme years are intentional. Budget, election and programme content was unchanged apart from retrieval timestamps.

Three importer corrections were made:

- **1,439 missing lobbying subjects restored.** The official project label is stored in `contactTopicProject.fi`; the importer previously looked only for a legacy `title`. Free-text subjects retain priority. All 11,861 imported topics now have a subject, with no changes to contact counts, targets, gifts or interests.
- **Rate-limit recovery corrected.** Parliament, civic and programme refreshes now wait at least a quota window after HTTP 429 and honor numeric or HTTP-date `Retry-After` headers. Attempts remain bounded and final failures add no unnecessary wait. Both daily workflows watch the shared helper for changes. Parliament logs yearly source counts for easier coverage checks.
- **AI batches continue after a truncated record.** Truncated output stays unpublished and pending while other records continue. No request/token limits or retries were increased. The current AI cache remains a partial backfill (333 vote briefs and 341 matter briefs); today's 950-request allowance was exhausted, so no new inference was run during this audit.

Verification completed: `npm run check` passed all **166 unit tests** and full generated-data validation. The full browser suite passed route, filter/export, navigation, mobile, FI/SV/EN, theme and accessibility checks with no reported accessibility findings. A final focused browser check passed in both reading views for restored subject search, 320px wrapping, the latest vote, today's session, full transcripts and matching refresh timestamps. The generated Parliament browser payloads were rebuilt successfully. Whitespace validation passed.

One separate hosting observation remains: the old GitHub Pages HTTPS URL redirects to HTTP on the custom domain, while `https://vahtikissa.fi/` itself works. Hosting settings were not changed by this local audit.

Sources: [Parliament structured API](https://api.eduskunta.fi/), [today's minutes](https://www.eduskunta.fi/valtiopaivaasiakirjat/PTK+101/2026), [today's webcast](https://verkkolahetys.eduskunta.fi/fi/taysistunnot/taysistunto-101-2026), [State Treasury monthly index](https://api.tutkihallintoa.fi/valtiontalous/v1/budjettitalousvuosikuukausi), [Statistics Finland](https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/evaa/), [Transparency Register periods](https://public.api.avoimuusrekisteri.fi/open-data-term), [official lobbying declarations](https://public.api.avoimuusrekisteri.fi/open-data-activity-notification/term/5), [Pohtiva 2023 collection](https://www.fsd.tuni.fi/pohtiva/vaalit/6), [deployed Parliament metadata](https://vahtikissa.fi/data/metadata.json).
