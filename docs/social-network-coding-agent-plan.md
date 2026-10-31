# Coding-agent plan: selectable parliamentary analysis

Status: all 14 features selected by the user on 31 October 2026 for implementation in a new thread. This plan converts [the research proposal](social-network-analysis-plan.md) into an implementation contract for this repository.

Execution constraints from the user: use subagents where helpful, use no Astra model for the main agent or any subagent, and use ASCII-only names for all new files and folders. Preserve appropriate Finnish/Swedish text in content and existing unrelated paths.

## 1. Choose the implementation scope

Change `[ ]` to `[x]` to select a feature, or use the conversation's feature picker and copy its generated handoff into the implementation request. These are implementation choices, not visitor-facing feature flags.

**Selection precedence:** the user's explicit implementation request overrides this checklist. A generated handoff's complete selection block replaces this checklist; do not union the two. Otherwise this checklist is authoritative. Recommendations and saved picker state are not implementation authorization. With no selected features, report that scope is empty and make no application changes.

### Voting and speech trends

- [x] `vote-neighbours` — MP voting-neighbour cards and supporting votes. Recommended starter; medium effort.
- [x] `party-heatmap` — Party agreement heatmap and within-party cohesion. Recommended starter; medium effort.
- [x] `keyword-comparisons` — Compare keyword/phrase trajectories across MPs or parties. Recommended starter; medium effort.
- [x] `emerging-phrases` — Rising/falling expressions with support and speaker breadth. Medium effort.
- [x] `cross-party-profiles` — Inspectable cross-party voting connections. Medium effort.

### Institutional and issue relationships

- [x] `committee-overlap` — Connections through overlapping dated committee/body membership. Medium effort.
- [x] `topic-profiles` — MP attention to matters/topics, with source speeches. Medium effort.
- [x] `layer-comparison` — Compare the same MPs across at least two analytical layers. Medium effort.

### Graph analysis and visualization

- [x] `betweenness` — Exploratory brokerage measure on an explicitly constructed graph. Medium–large effort.
- [x] `communities` — Validated community discovery and grouping stability. Large effort.
- [x] `network-explorer` — Interactive nodes/edges with a searchable table equivalent. Medium–large effort.

### Additional sources and experimental text analysis

- [x] `lobbying-network` — Declared organisation–topic–target relationships. Large effort.
- [x] `directed-references` — Extracted references to MPs and attention received. Large effort; evaluation required.
- [x] `phrase-uptake` — First-observed phrase use and subsequent-use timelines. Medium–large effort.

Effort is relative and includes source inspection, accessible presentation and validation. **Recommended starter:** `vote-neighbours`, `party-heatmap`, `keyword-comparisons`. This recommendation does not select them.

### Analysis choices for selected advanced features

Edit the following values only when their feature is selected. These declared defaults are routine implementation choices, not additional public features.

```yaml
betweenness_layer: voting          # voting | committees | topics
communities_layer: voting         # voting | committees | topics
network_explorer_layer: voting    # voting | committees | topics | lobbying | references
layer_comparison_layers: [voting, committees]  # choose at least two of voting, committees, topics
```

There is one layer per graph feature in the first implementation; multi-layer graph switching is outside scope unless explicitly requested. Feature-specific source layers may differ. If an advanced feature is unchecked, ignore its configuration. Reject invalid or ambiguous configurations without silently substituting another layer; continue independent selected work where possible.

## 2. Instructions to the coding agent

Implement only the selected public features and the shared support they require. Unchecked features are out of scope. For example, cross-party profiles need pairwise ballot calculations but do not require voting-neighbour cards. Community discovery does not imply an interactive graph or a betweenness leaderboard.

Begin by reading repository instructions, checking the existing working-tree changes, and inspecting current source schemas and tests. Preserve unrelated changes. Use the latest available local snapshots; the research proposal's 20 October 2026 counts describe an audited example, not fixed expectations. Do not refresh external data or regenerate unrelated collections merely to implement a feature.

Reuse the static application and existing research tools. Add no graph database, visitor-time inference, generic feature-flag administration, new hosting system or paid service. Do not publish, deploy, commit or create a pull request unless the implementation request authorizes it. A new dependency is acceptable only when its benefit justifies it and it fits the current project; document that choice.

For each selected feature, implement its calculations, appropriately scoped UI, evidence navigation, filtered export and meaningful checks. Required correctness, provenance, missing-data handling and accessibility are not optional checkboxes.

## 3. Conditional shared support

Build only the capabilities required by the selected features and configured layers:

| Support | Required by | Implementation notes |
| --- | --- | --- |
| Source manifest and evidence resolution | Every selection | Record exact source-component hashes/snapshots, method version, configuration, coverage and exclusions. Independently refreshed collections need not share a timestamp. |
| Ballot relationships | Voting neighbours, cross-party profiles, any voting graph/layer comparison | Reuse `[voteId, mpId, recordedParty, choice]`; calculate supported pair statistics. |
| Party positions | Party heatmap | Unique modal choice per roll call, tied/missing positions excluded, cohesion separately. |
| Speech aggregation | Keyword comparisons, emerging phrases, topic profiles, phrase uptake, topic graph/comparison | Reuse transcript chunks, query semantics and existing denominator logic where relevant. |
| Membership intervals | Committee overlap, any committee graph/comparison | Canonical bodies, overlapping appointment dates, roles and interval deduplication. |
| Lobbying identities | Lobbying network or lobbying explorer layer | Organisation IDs, reviewed person crosswalk, declaration/topic/target deduplication. |
| Reference extraction | Directed references or references explorer layer | Separate extraction and evaluation; source passages and ambiguous matches retained. |
| Graph construction | Betweenness, communities, explorer | Declare nodes, edges, weights, sparsification and, where needed, distances. Do not require unrelated public views. |

A layer-comparison feature can build its two configured layers without selecting their standalone views. Likewise, a graph feature can build its configured source layer without selecting a separate view for that layer. These are internal calculation dependencies, not extra feature selections.

## 4. Work packages and acceptance criteria

### `vote-neighbours`

**Build:** an MP's nearest voting neighbours with common-vote counts, agreement rates, and agreement/disagreement evidence. Include period and existing issue filters where the result can be computed correctly within the payload budget.

**Method:** pair agreement = identical choices / jointly eligible ballots. Eligible choices are yes/no/abstain; exclude absence, unknown choices and missing ballots. Use each event's recorded party. Include a yes/no-only comparison and a declared contested-vote comparison. Assess equal-matter/session weighting so repeated amendments do not dominate.

**Done when:** agreement is symmetric; fixtures cover abstention, absence, missing ballots, party changes and no common votes; ties remain ties; low support is labelled; source votes reproduce displayed values. Define and publish minimum support and contested-vote thresholds after a pilot on several issues.

### `party-heatmap`

**Build:** a party-to-party agreement matrix with readable numeric/table equivalents, counts and contributing votes. Show within-party cohesion alongside it.

**Method:** compare unique modal eligible choices for each party per roll call. Exclude tied or missing positions; do not weight a party pair by its number of MP pairs. Report modal support separately from inter-party agreement.

**Done when:** symmetry, tied modes, no overlap, changing party rosters and unanimous/split party votes are covered; the denominator is visible and reproduced by source evidence. Party identity comes from ballots at the time.

### `keyword-comparisons`

**Build:** comparable monthly keyword/phrase charts for selected MPs or parties, reusing existing query modes, filters and excerpts. Show mentions per 10,000 words, raw mentions, matching speeches and distinct speakers; offer speech prevalence.

**Method:** use the selected corpus before the positive query, with the existing exclusion semantics, as denominator. A period with no corpus words has no rate. Mark partial months and coverage gaps. Preserve original full transcripts behind normalized excerpts.

**Done when:** chart values and CSV/JSON agree with existing query aggregation, filters apply consistently, metadata-only matches do not inflate transcript counts, and a chart point opens supporting speeches with matching settings.

### `emerging-phrases`

**Build:** rising/falling term or phrase candidates with time windows, baseline, support, distinct speakers and party breadth. Reuse corpus aggregation without requiring the comparison-chart UI.

**Method:** document candidate generation, phrase length, stopwords, minimum support, comparison windows and handling of zero baselines, recesses and partial periods. Show counts/rates rather than unsupported significance claims. Do not treat one speaker's repeated phrase as broad uptake.

**Done when:** fixed synthetic corpora cover repeated wording, zero/small baselines and missing periods; each candidate opens evidence; uncertain low-support results are suppressed or labelled; language/morphology limits and exploratory selection among many terms are explained.

### `cross-party-profiles`

**Build:** profiles of the strength and breadth of voting alignment outside an MP's recorded party, showing which groups and votes contribute.

**Method:** normalize against available counterparts and contemporaneous group sizes. Document how party switches divide a person's observations and how party composition affects comparison. Keep activity, breadth and alignment distinguishable.

**Done when:** results include sample sizes, group-size/activity baselines and sensitivity to period and matter weighting. Indistinguishable or unstable results do not become a precise ranking. This feature does not add betweenness or communities.

### `committee-overlap`

**Build:** date-filtered institutional connections, membership records and shared-body evidence.

**Method:** intersect membership intervals with each other and the selected period, canonicalize historical body names, distinguish role types, and deduplicate overlapping appointments. Keep the MP–body representation. Any MP projection must document time weighting and committee-size correction. Open-ended terms are capped at the analysis coverage end.

**Done when:** disjoint/touching/overlapping intervals, duplicate roles, unknown dates and historical name variants are handled explicitly. Shared membership is labelled institutional proximity.

### `topic-profiles`

**Build:** MP–matter/topic attention profiles with participation/within-MP shares, dates, comparison views and supporting speeches.

**Method:** distinguish attention from stance; retain underlying matter links. Broad metadata-derived topic tags are discovery aids. Do not derive semantic similarity from only the top word-cloud terms or merge Finnish/Swedish terms as equivalent without evaluation.

**Done when:** denominators and coverage are visible, prolific speakers do not dominate solely through raw volume, filters reproduce evidence, and metadata tagging limitations are displayed. This feature does not add communities automatically.

### `layer-comparison`

**Build:** compare an MP's neighbours or relationships across the configured two or three layers, with separate labelled units, evidence and coverage.

**Method:** use a comparable time window and shared identity crosswalk; disclose differences in coverage. Do not combine similarity, shared days and topic attention into a universal score.

**Done when:** at least two configured layers are present, unavailable observations stay unavailable, and users can inspect the source of similarities/differences. Supporting calculations do not expose unchecked standalone views.

### `betweenness`

**Build:** exploratory brokerage results for the configured voting, committee or topic layer, with graph-construction details and connecting-group evidence. A table is sufficient; graph visualization is separate.

**Method:** explicitly define sparsification and positive similarity-to-distance conversion, components, normalization and minimum support. Compare reasonable neighbour counts/thresholds, windows and weighting variants. Paths on a similarity graph are analytical constructs, not observed communication routes.

**Done when:** a hand-checkable graph verifies calculations; disconnected and tied cases are covered; sensitivity is reported; unstable rankings are labelled/suppressed. Do not describe the score as proven political influence.

### `communities`

**Build:** validated group assignments for the configured layer, evidence, method settings and stability summaries. Do not require an interactive graph.

**Method:** evaluate an appropriate community algorithm such as Leiden with pinned seeds/resolutions. For affiliation/topic sources, use a bipartite-aware method or documented popularity-corrected projection. Existing coarse topic tags alone are insufficient evidence of substantive emergent factions.

**Done when:** repeated runs and reasonable configurations are evaluated; groups are compared with party structure and input-appropriate baselines; unstable assignments stay exploratory/unpublished. Implementation may be complete with a documented finding that the data does not support stable public communities.

### `network-explorer`

**Build:** one configured graph layer with an MP/actor-focused view, evidence inspection, source/method labels and a searchable node/edge table. Respect existing date/topic controls where supported.

**Method:** layout has no analytical meaning. Keep identity, size and edge-weight encodings labelled; bound rendering costs and load only the selected view's data. Do not add community colouring or brokerage rankings unless selected separately.

**Done when:** keyboard and table access provide equivalent information; mobile widths and reduced motion work; nodes/edges open evidence; unsupported layer data and extraction-quality gates have explicit states. Explorer selection alone may build source-layer support, but adds no unchecked rankings.

### `lobbying-network`

**Build:** organisation–declared topic–reported target exploration by closed reporting period, with declaration links and distinct-organisation/topic/period counts.

**Method:** use company IDs, normalize display labels, deduplicate declaration/topic/target relationships, and maintain a reviewed target-to-person crosswalk. Keep unmatched, ambiguous and non-MP targets visible separately. Target associations are not meetings; reporting windows are not precise contact timestamps.

**Done when:** duplicate IDs/labels, recurring recipients, unresolved identities and reporting-period boundaries are covered; counts reconcile with declarations. No lobbying-effectiveness or corruption score is produced. A reviewed crosswalk is required before person-level derived rankings; unresolved cases remain unranked.

### `directed-references`

**Build:** extracted explicit references/quotations to MPs with source passages, candidate identities, confidence/evaluation information, and separate incoming-attention/breadth measures.

**Method:** preserve ambiguous names, negation, quotations and challenges. A response speech type or transcript order does not identify its addressee. Distinguish supported reference types; do not assume a reference is endorsement or that a general sentiment score classifies the relationship.

**Done when:** create a human-review sample and declare a precision target before evaluation; evaluate against independent human labels. Until that gate is met, deliver extraction/evaluation tooling with public person rankings disabled and report evaluation as pending. Never claim that agent-generated labels are independent human review.

### `phrase-uptake`

**Build:** first-observed expression use and subsequent-use timelines by speaker/party, with corpus start date and supporting excerpts.

**Method:** normalize phrase matching transparently, handle ties and time zones, and show repeated use across matters/dates. Earliest stored use is not authorship. Chronological use alone does not create a person-to-person transmission edge; explicit references are a separately selected feature.

**Done when:** fixtures cover simultaneous first uses, repeated quotations, partial archive coverage and absent periods; users can inspect later uses; labels consistently say first observed in our corpus.

## 5. Implementation sequence and likely touchpoints

1. **Resolve scope.** Record chosen IDs and applicable layer settings in a short implementation summary. Inspect `git status`, current schemas and repository instructions. If none are selected, stop without application edits.
2. **Pilot selected methods.** Use a few representative matters/periods to establish thresholds and expose data gaps. Use synthetic fixtures for mathematical edge cases. Do not hardcode rankings or the old snapshot's counts.
3. **Build conditional support.** Add pure, testable aggregation/graph helpers only where selected work needs them. Reuse existing parsers and query definitions.
4. **Generate data where needed.** A prospective `scripts/build-network-analytics.mjs` can create small `data/networks/` payloads and a manifest. For keyword-only work, extending existing speech views/aggregation may be sufficient; an unrelated Relationships route or network builder is not mandatory.
5. **Integrate selected UI.** Reuse current routing, profile sections, filters, exports and reading views. Add a Relationships route only for selections that warrant it. Unselected options must not leave empty tabs or navigation entries.
6. **Wire builds and validation.** Integrate required derived output with sync/deploy preparation. Identical inputs/configuration should yield identical analysis results, apart from declared generation metadata. A failed analysis must not replace valid output with partial data.
7. **Verify and report.** Execute checks below, fix attributable regressions, and summarize selected feature results, changed paths, commands, evidence limits and remaining publication gates. Report unchecked IDs as excluded, not unfinished work.

| Concern | Existing places to inspect before choosing edits |
| --- | --- |
| Ballots, event identity, matters and sessions | `scripts/sync-data.mjs`, `scripts/lib.mjs`, `app-utils.js` |
| Date-valid memberships | `scripts/member-profiles.mjs`, `member-insights.js`, `data/member-profiles.json` |
| Query counts, full text and speech UI | `speech-research.js`, `speech-research-app.js`, `scripts/build-speech-analytics.mjs`, `app.js` |
| Scoped browser data and loading | `scripts/build-parliament-data.mjs`, `parliament-data.js` |
| Lobbying identities and declarations | `scripts/sync-civic-data.mjs`, `civic-utils.js`, `civic-apps.js`, `data/influence.json` |
| Navigation, languages, reading views and export | `navigation.js`, `app.js`, `simple-mode.js`, `simple-civic.js`, `collection-tools.js`, `styles.css`, `simple.css` |
| Build/sync integration and regression checks | `package.json`, `scripts/validate-data.mjs`, `.github/workflows/`, `tests/` |

These are orientation hints, not a requirement to modify every file. Recheck current layout at implementation time.

## 6. Shared definition of done

- **Scope:** every selected feature has its required implementation or an explicitly reported publication-quality gate; no unchecked public feature was added. The unselected full graph, betweenness and communities remain separate.
- **Correctness:** units, denominators, event-time identities, time windows and minimum support are documented. Unknown/insufficient data remains distinct from zero. Mandatory robustness checks are proportionate to each selected method.
- **Evidence:** all results open source records reproducing their values under the manifest. Preserve matching source evidence for old valid results, or mark analysis stale/unavailable when source data changes. Do not put revised records behind an old score.
- **Accessibility:** native controls, keyboard access, readable tables, 320px layouts, themes and reduced motion. Existing FI/SV/EN guidance conventions and full/simple views are respected; original records retain their published language.
- **Performance:** lazy-load selected analysis views; keep existing homepage and scoped-detail budgets. Avoid loading all transcripts/ballots just to show a summary. Measure any arbitrary-filter computation before exposing it.
- **Exports:** selected feature tables/charts have CSV/JSON with active filters, method/settings, relevant counts and manifest identity; exports and UI reconcile.
- **Validation:** run `npm run check` and `npm run build:data` for implementation changes, plus focused tests for selected numerical methods. For UI changes run `npm run test:browser`; run `npm run test:charts` for chart/heatmap changes and `npm run test:performance` when loading/payload paths change. Extend existing suites with meaningful selected-feature cases. Tests must run offline without paid services or secrets. If the environment blocks a check, report the specific unverified part.
- **Scientific labels:** centrality is network position; shared topics are attention, committee overlap is institutional proximity, and declarations are reported associations. No universal influence score, inferred persuasion or unvalidated faction claims.

## 7. Copyable agent request

After editing the checklist, send this request to a coding agent in this repository:

> Implement the selected features in `docs/social-network-coding-agent-plan.md`. Read its scope rules, conditional dependencies, feature contracts and acceptance criteria, using `docs/social-network-analysis-plan.md` for background. Treat checked feature IDs as the complete public scope; ignore unchecked features and recommendation presets. Build only the shared support required by those selections and their configured layers. Preserve unrelated working-tree changes, reuse the existing static architecture, implement and verify the selected work, and report results plus any unmet publication-quality gates. If no features are selected, make no application changes.

When using the picker, copy its generated handoff instead: its explicit complete selection and advanced-layer settings replace section 1 for that run. The picker updates its own conversation state; it does not edit this Markdown file or start implementation.
