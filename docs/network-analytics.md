# Relationships research view

Open `#/relationships`, or use the relationship link on an MP profile. The view
works in full and simple reading modes, with Finnish, Swedish and English
guidance. Original source records retain their original language.

## Implemented feature IDs

`vote-neighbours`, `party-heatmap`, `keyword-comparisons`, `emerging-phrases`,
`cross-party-profiles`, `committee-overlap`, `topic-profiles`, `layer-comparison`,
`betweenness`, `communities`, `network-explorer`, `lobbying-network`,
`directed-references`, `phrase-uptake`.

Graph features use voting; layer comparison uses voting and committees. The
planning picker is not application UI. There is no combined influence score.

## Build and verify

```sh
npm run build:data
npm run validate:networks
npm run test:networks
npm run check
npm run test:network-browser
npm run test:browser
npm run test:charts
npm run test:performance
```

The build uses local snapshots only and needs no credentials, services, model
inference or new dependencies. The initial build takes a few minutes. Subsequent
development-server starts reuse outputs when every recorded input stat matches.
`npm run build:networks -- --force` recalculates unchanged inputs for a
determinism check. Generated files in `data/networks/` are ignored by Git;
deployment preparation generates them through `build:data`.

The index points to an immutable content-addressed directory. Its manifest binds
every source component and calculation method by SHA-256 and records independent
source snapshot timestamps. Every browser payload also has a SHA-256 digest and
manifest ID. Evidence contains frozen ballots, vote alternatives, full original
transcripts, appointment histories and original lobbying declaration rows.
Browser calculation modules are frozen and hash-checked in the same directory;
an older open view never silently runs a newly deployed method on its old data.
Changing a source or method creates another directory. The index is replaced
only after every file is written and the inputs have been rechecked. Failed
builds retain the old index and its matching evidence. Do not delete old
directories while readers may still be using them.

The homepage requests no network analyses. The research view loads the manifest
and only the chosen analysis; transcripts, common ballots, party-event positions
and declaration details load on demand. Tables render at most 300 summary rows;
exports include every matching summary row. Voting supports precomputed whole
archive, calendar-year and existing metadata-topic scopes. These are separate
scopes, not an unmeasured arbitrary Cartesian product of filters. Graphs and
layer comparison explicitly use the common full stored window. Institutional
date recalculation and custom transcript queries run in a browser worker.
Custom transcript queries are limited to three calendar months per request.

All exported rows include manifest identity, feature ID, method and active
settings. Missing corpus and insufficient support remain distinct from zero.
Evidence navigation retains the analysis snapshot, while separate links to the
existing live speech browser identify it as the current collection.

## Methods and publication gates

- [Voting and graph definitions, thresholds and pilot](network-voting-methods.md).
- [Speech, candidate generation and reference evaluation](network-speech-methods.md).
- [Membership intervals, projections and lobbying identities](network-institution-methods.md).

The initial local pilot does not support stable public community assignments.
The view publishes algorithm settings, repeated seeds/resolutions, adjusted Rand
stability and party baselines while withholding unstable assignments. Brokerage
shows the selected MP's score and sensitivity range without an ordinal ranking.
Reasonable k-neighbour counts, matter weighting, yearly windows and deterministic
whole-matter block resamples (seeds 11, 29, 47) are compared. Bootstrap variants
use original common-ballot support gates and retain unavailable sampled pairs.

Reference extraction is an evaluation tool. Person rankings remain disabled.
The predeclared review policy requires the unchanged fixed sample to be completed
by independent humans, enough unambiguous labels, and a 95% Wilson lower precision
bound of at least 0.95. No independent human labels have been supplied. To prepare
an unlabelled review artifact, copy the manifest ID from the view:

```sh
npm run network:review -- sample data/networks/MANIFEST_ID/reference-extraction.json work/reference-review.json
npm run network:review -- evaluate data/networks/MANIFEST_ID/reference-extraction.json work/reference-evaluation.json work/reference-review.json
```

The tool exclusively creates output files and binds review labels to exact
candidate contents, method, policy, fixed sample and manifest. It never marks an
unreviewed template as human reviewed. Even a passing evaluation only describes
the independently reviewed references; it does not silently approve all other
extracted references for publication.

Lobbying person identities need a separately reviewed crosswalk. Unreviewed,
ambiguous, unmatched and non-MP recipients remain labelled and unranked. The
snapshot has notification IDs and diary numbers but no verified individual
declaration URL. The view supplies complete frozen original rows, those IDs and
the official source-collection link; it does not invent declaration deep links.
Reporting periods are closed windows, not contact timestamps or meeting counts.

Committee source endpoint semantics are inferred from next-day role transitions,
because the local schema does not formally define inclusivity. Source end dates
are treated as inclusive and converted to exclusive UTC interval boundaries;
this assumption and the explicit alternative are versioned in the method.
