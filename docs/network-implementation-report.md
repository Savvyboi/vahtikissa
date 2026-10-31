# Parliamentary relationships implementation report

Completed locally, 1 November 2026. All 14 features approved on 31 October are
implemented in the existing checkout. Existing unrelated working changes were
preserved. No source refresh, new dependency, commit, pull request, publication
or deployment was performed. Delegated work used the inherited non-Astra model.
New implementation, test, temporary and generated paths use ASCII names.

Open `#/relationships` from the navigation, or follow the new link on an MP
profile. Full/simple views share accessible native controls, evidence tables,
theme support, reduced-motion support, and FI/SV/EN guidance. The planning picker
is unchanged as a planning artifact.

## Implemented IDs

| Feature ID | Delivered behavior |
| --- | --- |
| `vote-neighbours` | Supported common-ballot comparisons; abstention/absence handling; yes/no, contested, equal-matter and equal-session sensitivity; complete frozen ballot evidence. |
| `party-heatmap` | Symmetric numeric agreement matrix, tied/missing modal exclusions, separate equal-event and ballot-weighted cohesion, complete contributing-roll-call inspection. |
| `keyword-comparisons` | Comparable monthly party/MP charts and tables; corpus-before-query denominators, exclusions, prevalence, speaker breadth, null gaps, partial months and exact source inspection. |
| `emerging-phrases` | Exploratory rising/falling one-/two-token expressions, declared windows and support thresholds, speaker/party breadth, counts/rates and excerpts. |
| `cross-party-profiles` | Recorded-party spells, counterpart group-size/activity baselines, equal-event/group alignment, matter sensitivity and full event evidence. |
| `committee-overlap` | Canonical dated MP-body records, roles, deduplicated intervals, shared/size-corrected body-days, date recalculation and original membership histories. |
| `topic-profiles` | MP-normalized topic and matter attention; participation and word shares, dates, denominators and supporting speeches. |
| `layer-comparison` | Voting and committee relationships in separate units, with common identity/window context and separate coverage/evidence. |
| `betweenness` | Weighted shortest-path calculation, components, selected-MP exploratory values, sensitivity ranges and connecting evidence; no ordinal rankings. |
| `communities` | Seeded community evaluation, connected-component refinement, repeated seeds/resolutions, graph variants, block resamples and party baselines. Unstable assignments withheld. |
| `network-explorer` | Bounded interactive voting ego graph, edge evidence, native linked-node alternatives, searchable node/edge tables and matching exports. |
| `lobbying-network` | Company-ID organisation/topic/reported-target exploration, closed periods, deduplication/reconciliation, unresolved identities and complete original declaration rows. |
| `directed-references` | Rule-based explicit-name candidates, ambiguous identities, passages and a fixed human-review sample; content-bound review/evaluation CLI. Public person rankings disabled. |
| `phrase-uptake` | Corpus-first observed timelines, UTC ties, later/quoted uses and speaker/party/matter/date breadth. Custom limited-window results are labelled as limited-window observations. |

Graphs use voting. Layer comparison uses voting plus committees. No universal
influence score, inferred persuasion, visitor-time AI or new hosting system was
introduced.

## Snapshot, provenance and limits

Final manifest: `ee7386eaa3b368e631d9044b`.

- Parliamentary snapshot: `2026-10-20T16:41:01.472Z`.
- Profile snapshot: `2026-10-20T16:41:01.117Z`.
- Lobbying snapshot: `2026-10-20T16:35:29.603Z`.
- Stored observation window: 25 April 2023 through 20 October 2026; coverage
  remains separately reported for each layer.
- 8,057 hashed JSON payloads and six frozen browser calculation modules. The
  current generation occupies approximately 381.8 MB before HTTP compression.
- Sixteen precomputed voting scopes: whole archive, four years and eleven
  existing metadata topics. Unsupported arbitrary cross-products are not
  presented as computed results.
- Complete source evidence is frozen under the manifest directory. The index is
  replaced last; a failed build preserves the last valid index and evidence.
  Browser calculations verify and load the matching frozen method modules.
- Pair summaries use a lossless transfer representation retaining original
  numerators and denominators. Exports contain unrounded values, method,
  manifest identity and active calculation/table settings.
- Speech coverage reports 40,501 records, 23 external-speaker records and four
  missing transcripts. MP topic profiles exclude external speakers explicitly.

Homepage loading remains unchanged: no Relationships payloads or analysis
modules are requested there. A focused initial heatmap requested approximately
0.99 MB of additional relationship data. A maximum three-month custom speech
query selected 8.11 MB and completed in approximately 1.34 seconds including
loading, calculation and export in local Edge. Such queries are explicit,
bounded to three months and calculated in a worker; these timings are local
measurements, not service guarantees.

## Validation

| Command/check | Result |
| --- | --- |
| `npm run build:data` | Passed; Parliament and network payloads generated from local sources. |
| `npm run check` | Passed: 253 unit tests plus existing source/data validators. |
| `npm run test:networks` | Focused numerical/provenance cases pass; 48 tests are included in the full suite. |
| `npm run validate:networks` | Passed all payload hashes, current source/method hashes, frozen worker modules, exact sampled common-ballot reconstruction and publication gates. |
| `npm run test:network-browser` | Passed all 14 feature views/JSON exports, voting/party/cross-party/declaration/membership/speech evidence, custom worker settings, graph edge interaction, themes, FI/SV/EN, full/simple views and 320/390px layouts. |
| `npm run test:browser` | Passed the complete existing interaction/responsive/accessibility suite, including updated navigation route expectations. |
| `npm run test:charts` | Passed existing chart alternatives and palette/contrast checks. New matrices/charts have table equivalents in the focused suite. |
| `npm run test:performance` | Passed homepage script/data budgets, scoped detail loading, keyboard/focus, reduced-motion and theme checks. Full homepage JavaScript measured 229,705 bytes, within its 230,000-byte budget. |
| Reference-review CLI | Created a 240-record unreviewed template; evaluation correctly reports zero accepted human labels and a pending publication gate. |
| `git diff --check` | Passed. |

The bundled Playwright browser executable was absent locally. Browser checks
used the installed Edge channel (`BROWSER_CHANNEL=msedge`); CI retains its
existing Chromium installation.

## Unmet publication gates and source limitations

1. **References:** independent human labels have not been supplied. The fixed
   review sample, minimum unambiguous-label requirement and 95% Wilson lower
   precision bound of 0.95 remain unmet. All public person rankings are disabled;
   no agent-generated labels were treated as independent review.
2. **Lobbying identities:** the independently reviewed target-to-person
   crosswalk is absent. Unreviewed, ambiguous, unmatched and non-MP targets stay
   labelled and unranked.
3. **Communities and brokerage:** current data does not meet the community ARI
   stability target of 0.9. Minimum seed/resolution ARI is approximately 0.856;
   the ten graph/window/weight/bootstrap variants have minimum ARI approximately
   0.432. Public assignments are withheld. Brokerage is exploratory/unstable and
   ordinal rankings are not published.
4. **Declaration links:** the stored source has notification IDs and diary
   numbers, but no verified individual-declaration URL. Complete frozen original
   rows plus those identifiers and the official collection link are supplied.
5. **Membership endpoints:** source end-date inclusivity is inferred from local
   role transitions rather than formally declared by the stored schema. The
   versioned method documents that inference and an explicit alternative.

These are explicit publication/source limits; the independent feature
implementations and evaluation tools are complete.

## Changed paths for this implementation

Added calculation/support modules:
`network-voting.js`, `network-graph.js`, `network-speech.js`,
`network-institutions.js`, `network-lobbying.js`, `network-format.js`,
`network-data.js`, `network-worker.js`.

Added UI: `relationships-app.js`, `relationships.css`.

Added tooling: `scripts/build-network-analytics.mjs`,
`scripts/validate-network-analytics.mjs`, `scripts/network-reference-review.mjs`,
`scripts/check-network-browser.mjs`.

Added focused tests: `tests/network-voting.test.mjs`,
`tests/network-graph.test.mjs`, `tests/network-speech.test.mjs`,
`tests/network-institutions.test.mjs`, `tests/network-lobbying.test.mjs`,
`tests/network-data.test.mjs`.

Added documentation: `docs/network-analytics.md`,
`docs/network-voting-methods.md`, `docs/network-speech-methods.md`,
`docs/network-institution-methods.md`, `docs/network-implementation-checklist.md`
and this report.

Integration edits: `app.js`, `index.html`, `server.mjs`, `package.json`,
`.gitignore`, `README.md`, `.github/workflows/browser-check.yml`,
`scripts/browser-simple-checks.mjs`, `scripts/browser-ui-checks.mjs`.
Existing unrelated edits in these and other files were retained.

Generated outputs are ignored under `data/networks/`; verification screenshots,
the unreviewed review template and evaluation artifacts are ignored under
`.hermes-tmp.networks/`. Both use ASCII paths. Earlier immutable build generations
remain available so already-open readers do not lose their matching evidence.
