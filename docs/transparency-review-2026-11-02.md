# Transparency explorer review — 2 November 2026

Reviewed the release at `https://vahtikissa.fi/#/relationships` and the saved
checkout at `ae766d258bf6bc7791cdd6291f7e07a7d96bc7b8`, including the explorer
introduced in `05c1a3f`. This report records the pre-publication local audit. Pushing and deployment were subsequently authorized on 2 November 2026.

## Findings and fixes

| Severity | Finding | Local correction |
| --- | --- | --- |
| P1 | Every declaration in the broad administrative category was treated as a board role. Municipal councillors and delegates could therefore produce false “Shared boards” links and affect board-peer E–I. | Require explicit board, supervisory-board or executive-board wording. Keep parsed council/delegate roles as ordinary interests. Resolve repeated leading roles to the named employer/municipality; omit bare job titles and ambiguous narrative fragments instead of inventing organisations. |
| P1 | The legacy theme checks exposed actual mixed theme colours: black pagination text on navy, contrast 1.86. The earlier committee-overlap contrast failure used the same global theme mechanism. | The global reduced-motion rule had given **every** element a nonzero transition duration, creating transitions on otherwise unanimated elements. Set transition duration/delay to zero and pair primary-button foreground/background through the theme palette. Retain the contrast assertion; add an assertion that reduced-motion transitions are actually disabled. |
| P2 | Three multiline gift donors were blank after parsing and their graph ties were omitted. A repeated use-period label inside one gift description also leaked the appended amount into the displayed use period. | Fix the shared gift parser and rebuild graph evidence from preserved original text. The next civic sync also uses the fixed parser. Keep missing amounts missing; nine undisclosed values no longer display as €0. |
| P2 | Lobbying evidence links used an unsupported API route. Recipient identity, consultant clients and name-to-ID matching were hard to inspect. | Use the verified declaration-by-diary-number endpoint. Add the snapshot's target index to lazy evidence, and show recipient IDs/names, clients and organisation matching provenance. Preserve both direct and inferred descriptors for a record. |
| P2 | Filtering an interlock to one year could retain other years in its displayed support metadata. | Intersect the surviving board evidence years on both supporting edges and export/display only those years. |
| P2 | Mobile table transforms hid column/party headings and overlapping record cells could intercept the heatmap control. | Keep the optional table and heatmap as tables inside bounded, keyboard-focusable horizontal scroll regions. Default mobile/easy cards remain available. |
| P2 | Opening the default explorer rewrote the primary URL, violating the shared navigation contract and allowing duplicate default-route history entries. | Keep `#/relationships` for defaults; serialize meaningful non-default settings. Preserve existing query links and legacy voting/speech routes. |
| P2 | One exact `HE113/2025` mention was missed; packing also lost the interest extraction provenance field. | Accept unspaced HE identifiers, reject zero/malformed identifiers, preserve extraction and organisation-match provenance through the packed format. |
| P3 | Dense labels, small source prose, unclear global metrics, and hidden-stage focus made inspection harder. | Show fewer overview labels, retain hovered/selected labels, enlarge evidence prose/touch targets, focus the visible evidence heading and restore its source action on close. Explain E–I/PageRank and the full-snapshot scope, including inferred links. Translate organisation categories into Swedish and English. |
| P3 | Slider changes rebuilt summaries even when no source descriptor was removed. Bill force positions also overwrote already precomputed bill coordinates. | Reuse offline edge summaries when valid, preserve offline bill coordinates, clear stale path/selection appearance on redraw, and prevent duplicate overlay animation frames. No browser-side force or centrality calculation was added. |

## Independent source evidence

Downloaded **all 219 official member profiles and all five closed lobbying
periods**, independently of the sync/build helpers. Compared all stored
**2,717 interest/income records, 491 gifts, 11,861 parliamentary lobbying topics
and 129,115 target references** with those official responses. The comparison
passed after the gift parsing corrections above. Raw responses remain local in
the ignored `.hermes-tmp.transparency-review/` directory.

The audit checks requested member IDs, exact names, declaration years, reported
dates versus use/contact periods, gift amounts, original gift text, business or
foreign registry IDs, topic text, clients, methods, exact recipient IDs/labels,
committee membership intervals/roles, ministerial intervals, snapshot parliamentary
groups and inclusion/omission of parliamentary topics. The source's `PG` group
code is checked against the site's established `tv` key for Timo Vornanen.

Representative manual traces include:

- [Anders Adlercreutz's official profile](https://api.eduskunta.fi/api/v1/kansanedustajat/1306): `1306-2026-sidonnaisuusilmoitus-4` declares Kirkkonummi municipal council membership. It remains an interest and is no longer board evidence.
- [Eeva Kalli's official profile](https://api.eduskunta.fi/api/v1/kansanedustajat/1412): `1412-2026-sidonnaisuusilmoitus-7` explicitly names an Alko supervisory-board role and remains eligible board evidence.
- [Pauli Kiuru's official profile](https://api.eduskunta.fi/api/v1/kansanedustajat/1137): `1137-2025-66` contains a multiline Suomen Sikayrittäjät donor; the €150 value, disclosure date and use period agree with the original. `1137-2026-80` separately confirms the €376.16 Parmaco gift and different disclosure/use dates.
- [IFPI declaration MUS-26-8134-T](https://public.api.avoimuusrekisteri.fi/open-data-activity-notification/diary-number/MUS-26-8134-T): topic `34742`, business ID `0280605-9`, exact named-recipient IDs and January–June 2026 contact period agree with the source. Punctuation variants in gift donor names now match this unambiguous business ID and are explicitly labelled as name matches.
- [Blic declaration BLI-26-7998-T](https://public.api.avoimuusrekisteri.fi/open-data-activity-notification/diary-number/BLI-26-7998-T): topic `34134` names HE 56/2026 and the client Tieto Finland Oy; the declared recipient is identified by target ID `4070`. The contact period ends in June while the disclosure date is in August.
- [Attendo declaration ATT-26-5389-T](https://public.api.avoimuusrekisteri.fi/open-data-activity-notification/diary-number/ATT-26-5389-T): topic `23013` contains the unspaced HE113/2025 reference now retained by the graph.

Official API documentation confirms that reporting is topic-based rather than a
meeting-by-meeting log: [Transparency Register open data](https://www.avoimuusrekisteri.fi/perustietoa/avoin-data)
and [API guidance](https://www.avoimuusrekisteri.fi/perustietoa/ohjelmointirajapinta-api).
The register's reporting-period and target APIs were checked directly too.

## Analysis and snapshot integrity

Independent small-graph tests enumerate shortest simple paths rather than using
Brandes, and solve PageRank as a linear system rather than using the production
iteration. They cover stars, split shortest paths, disconnected graphs, isolates,
unequal weights and two known dense communities. Degree, weighted degree, exact
normalized Brandes, weighted PageRank and seeded Louvain agree with those references.

On the entire rebuilt source graph, validation checks packed weights before
decoding recomputes them, original record identity and recipient support,
business IDs, exact HE mentions, reporting years, ordinary committee membership
overlaps, board support on both interlock endpoints, E–I and party shares.
PageRank satisfies its weighted fixed-point equation across every node.
Organisation coalitions are independently reconstructed by intersecting each
organisation pair's exact HE/committee-set targets; their top 150 ranking and
supporting target sets agree. This is shared targeting, not proven coordination.

Cabinet parties are derived from active source ministerial terms at
**2026-11-01**: KD, KOK, PS and R. This is snapshot party alignment, including
stored former/interrupted members, rather than historical bloc membership during
every contact period. The member collection contains 200 current, nine former
and ten interrupted mandates. Committee facets likewise use snapshot membership;
inferred lobbying associations require overlapping source membership intervals.

| Measure | Refreshed release baseline | Local corrected snapshot |
| --- | ---: | ---: |
| MPs | 219 | 219 |
| Organisations | 1,714 | 1,596 |
| Aggregated MP–organisation ties | 37,729 | 37,595 |
| Lobbying plus interest/gift ties | 96 | 104 |
| Board interlock pairs | 113 | 75 |
| Cross-bloc board interlock pairs | 54 | 44 |

The lower totals reflect more conservative extraction and canonical alias merges;
they are not newly observed changes in political activity. The corrected snapshot
contains 118,259 direct and 6,523 inferred lobbying source descriptors. It reports 1,944
unparsed interest/income records (including assets, debts and no declarations),
10,432 unmatched/unsupported recipient references and zero ambiguous full-name
matches. Omissions are retained in the source collection, not silently fabricated
into graph ties.

Final snapshot: `f26a5dc528b91212ed0b0a08`. A forced rebuild reproduced its graph
and evidence bytes exactly. All source/output SHA-256 hashes reconcile; the
builder now checks cached output hashes, and browser tests reject damaged graph
and evidence payloads and recover on retry.

## Browser and performance verification

The deployed release passed its original explorer browser suite. Local expanded
coverage includes all five presets and three layouts, the node-size controls,
outlines, compound include/exclude/year filters, threshold input, table/card
counts and heatmap cells, source inspection, global metrics, keyboard pan/zoom that preserves modified browser commands,
one- and four-hop paths, expansion/pruning, URL reloads, fullscreen and PNG/SVG/JSON
exports. Desktop evidence is audited in every theme. Phone/full/easy views are
audited at 320px and 390px in FI/SV/EN and all three themes, with separate optional
table/heatmap and error/retry checks. Existing Finnish/Swedish/English labels,
Sisällytä / Sulje pois, Vaalea / Tumma / Korkea kontrasti, Helppo näkymä and the
previous voting/speech analyses remain accessible.

Local Chromium measurements on this machine, without a physical-phone CPU or
mobile network simulation:

| Measurement | Desktop 1440px | Phone viewport 390px |
| --- | ---: | ---: |
| First useful list | 369 ms | 335 ms |
| Initial view ready | 458 ms | 335 ms |
| JSON parse / graph unpack | 14.1 / 64.6 ms | 22.9 / 61.4 ms |
| Threshold filtering and redraw handler | 51.3 ms | 32.2 ms |
| Renderer requested initially | Yes | No |
| Evidence requested initially | No | No |

Before summary reuse, the same filtering measurement was approximately 93 ms
desktop / 72 ms phone viewport. These are diagnostic local measurements, not
production latency guarantees. The graph is 7.29 MB raw, approximately 1.10 MB
gzip / 0.68 MB Brotli; lazy evidence is 9.86 MB raw / 1.24 MB gzip. Compression
figures are local encodings, not measured hosting transport settings. First
inspection still loads the whole evidence bundle; real low-end-phone and slow
network performance remains to be measured.

Validation commands/results and CI details are recorded below; raw logs and
screenshots are in ignored `.hermes-tmp.transparency-review*.log` and
`.hermes-tmp.sna/` paths.

- `npm run check`: 292 tests and source-data validation passed.
- `npm run build:data`, `npm run validate:networks`: passed; all 8,063 legacy payload hashes and the corrected source graph reconcile.
- `npm run audit:transparency-sources -- --fetch --all`: full independent official-source comparison passed after corrections.
- `npm run test:network-browser`: passed, including the original pagination contrast assertion and all 14 legacy features.
- `npm run test:transparency-browser`: expanded explorer, exports, filters, source recovery and theme/language/mobile/easy accessibility checks passed.
- `node scripts/check-relationship-mobile.mjs`: 320px/390px touch, source retry, focus/scroll restoration and FI/SV/EN full/easy modes passed.
- `npm run test:charts`: all 12 badge palettes passed; minimum theme contrasts 4.59, 14.55 and 21.00.
- `npm run test:performance`: existing desktop/mobile budgets, scoped details, labels, focus, reduced motion and theme checks passed.
- `npm run test:browser`: full-site interactions, navigation at ten phone/tablet/desktop sizes in FI/SV/EN, responsive layouts and theme accessibility passed after the default-route correction.
- `npm run test:release`: influence controls, keyboard/focus, active counts, themes/mobile, malformed URLs and blocked storage passed.

Inspected both [the pre-release CI failure](https://github.com/Savvyboi/vahtikissa/actions/runs/41329038731)
and [the release browser run](https://github.com/Savvyboi/vahtikissa/actions/runs/41362852581).
The exact 1.86 pagination failure reproduced on local Windows Chromium, so it is
not exclusive to Linux; rendering timing explained the inconsistent results.
No contrast assertion was relaxed. At audit time, hosted Linux CI had not run the follow-up
changes. The successful [release deployment](https://github.com/Savvyboi/vahtikissa/actions/runs/41363246205)
remains the deployed baseline.

## Remaining limits

Matching the complete stored inputs to official responses is stronger than
schema checking, but it does not authenticate what declarants asserted. Automatic
organisation/role extraction, aliases and sector categories have not all been
manually adjudicated or checked against an independent business registry.
Name-based canonical matches are labelled; conflicting IDs remain separate.
Shared disclosure years do not establish simultaneous board service. Committee
associations do not establish personal contact. Centrality, shared targets and
overlapping interests do not establish influence, wrongdoing or lobbying success.

The input snapshot's older derived gift fields were left intact; graph evidence
reparses their preserved originals, and the shared sync parser repairs future
snapshots. Generated payloads and downloaded raw responses remain ignored.
Unrelated `.codex-remote-attachments/`, `video.mp4` and `work/` were untouched.
Publication was authorized after this local review; deployment and workflow results are reported separately.

## Daily workflow preparation

Before publication, the Parliament daily workflow was fixed to install pinned dependencies before running the expanded test suite. The civic workflow now watches the shared gift parser so parser fixes trigger a refresh. Regression assertions cover both requirements. Existing daily schedules, shared writer serialization, AI request limits and deployment-from-current-main behavior are preserved.
