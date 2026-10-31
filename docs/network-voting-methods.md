# Voting relationships and graph methods

Method versions: `voting-1`, `voting-graph-1`. Calculations use local source snapshots; no data refresh or external inference is required. Dates are source event dates, with inclusive calendar-day filters. A missing observation is unavailable, never agreement of zero.

## Ballot relationships

Eligible choices are yes, no and abstain. Absence, unknown choices and missing ballots are excluded. Identical eligible choices divided by jointly eligible ballots is symmetric. Yes/no sensitivity removes abstentions from both numerator and denominator. A contested vote has at least 10% of eligible ballots differing from its overall modal choice. This includes abstention as a distinct choice.

Minimum support is 30 joint eligible ballots. This is a disclosure threshold, not a significance test. Below it, display the observation as low support without a precise rank. Equal agreement values remain ties. The pilot below illustrates why a seven-vote issue cannot support the same interpretation as hundreds of observations.

Equal-matter sensitivity computes each pair's agreement separately per document, then averages those rates with equal matter weight. Missing document identifiers fall back to session. Equal-session sensitivity follows the same definition by parliamentary year/session. Scratch counters are released per group to avoid a large nested pair-by-matter payload. Repeated amendments therefore cannot silently become independent issue observations. Date scopes supplied by the builder support period sensitivity as a separate comparison.

Duplicate identical ballot rows are deduplicated; conflicting eligible rows for a person/event are excluded and counted. Unknown party does not prevent voting-pair computation but is excluded from party measures.

## Party comparisons and cross-party profiles

Each party's position on a vote is its unique modal eligible choice. Tied modes and missing positions are excluded from inter-party comparisons. Every qualifying roll call has equal weight, independently of party size. Cohesion separately reports both ballot-weighted modal eligible ballots divided by all eligible ballots (`modalSupport`) and the equal-event mean of each roll call's modal fraction (`meanModalSupport`), with tied-vote counts retained. A tied vote can contribute modal-support cohesion but never a party position. `buildPartyEvidence` emits complete compact party choice counts and modal statistics for every selected roll call, using the identical eligibility, duplication/conflict handling and inclusive date scope as pair calculations. This on-demand evidence reproduces every inter-party numerator/denominator and both cohesion units, including zero-agreement cases.

Cross-party records are divided by MP, the MP's event-time party, and the counterpart's event-time party. For each eligible MP/event, agreement with a counterpart group is matching eligible ballots divided by available eligible group members. The reported alignment averages these fractions across events. This prevents large counterpart groups from dominating the event-weighted measure. Raw available counterpart ballots, matching ballots, mean available group size, number of events, and equal-matter alignment are separately exposed. Group availability and strength must be read separately from breadth; these rows are profiles, not a universal influence ranking.

Graph nodes retain counts for every recorded party in the selected eligible ballots. The descriptive party baseline uses the unique most frequently recorded party; ties and missing parties remain unknown. Party switches are flagged and never recoded to the person's present party. Graph party comparison is consequently a simplification of a changing history, while the actual ballot and cross-party calculations remain event-time calculations.

## Graph construction and position

Nodes are tracked MPs, including isolates. Supported positive similarities of at least 0.5 are eligible edges. The graph is the undirected union of each node's five nearest eligible neighbours. All ties at the fifth neighbour are retained; arbitrary ID ordering does not choose between tied connections. Ties can consequently produce a denser graph than five edges per node. Edge distance is strictly positive `1 / similarity`.

Weighted Brandes computes shortest-path betweenness with endpoints excluded. Undirected paths are divided by two for raw counts. Normalized scores use all graph nodes, including isolates, and divide directed accumulation by `(n-1)(n-2)`; fewer than three nodes have score zero. Disconnected components remain disconnected. These paths are analytical constructs, not observed communication, negotiation or persuasion routes.

Evaluate neighbour counts 3, 5 and 8, equal-matter weighting, and supplied alternative windows. Each person's score includes its range across supplied variants. A range exceeding `max(0.005, 25% of maximum score)` is flagged unstable. Ordinal brokerage rankings remain disabled; exploratory scores and their sensitivity are inspectable.

`buildMatterBootstrapAnalyses(input, {baseAnalysis, seeds: [11,29,47]})` adds deterministic equal-matter block resampling. For each seed, draw as many whole document blocks as there are distinct blocks, with replacement. Within each pair, each drawn matter contributes its own jointly eligible agreement fraction with equal weight; missing document IDs fall back to parliamentary year/session. Whole-block multiplicities are generated by the documented unsigned 32-bit LCG. Original joint-ballot counts remain the support gate, so resampling never promotes low-support pairs. If no sampled matter contains a pair observation, its bootstrap similarity is null, not zero. Seeds, block counts and numbers of distinct sampled blocks are retained in each variant's method/coverage.

The three variants are intended as reproducible sensitivity probes, not confidence intervals or a substitute for independent confirmation. Repeated identical amendments within a matter leave the equal-matter bootstrap similarities unchanged. A shared scratch-counter pass computes all seed variants without cloning ballot collections; supplied `baseAnalysis` avoids recalculating all base statistics. Each resulting voting-like object can be passed directly to `buildVotingGraph` and included in graph/community sensitivity.

## Communities and publication gate

The dependency-free community evaluator uses seeded weighted-modularity local moving from singleton groups, followed by splitting disconnected groups. It is explicitly a local-moving evaluator, not a claim to implement Leiden or find a global optimum. Seeds are 1, 7 and 19; resolutions are 0.75, 1 and 1.25. Runs are reproducible. Evaluation reports modularity, number of groups, adjusted Rand agreement across seeds/resolutions and supplied sparsification/weighting/window variants, adjusted Rand agreement with recorded-party groups, and party-partition modularity as an input baseline.

Public assignments require minimum adjusted Rand stability of 0.9 across both repeat configurations and supplied graph variants, more than one group, and reference modularity above 0.1. Without supplied sensitivity graphs the gate stays closed. Unstable results contain no public assignments. `evaluationAssignments` exists solely for offline diagnostics and should not be presented as public community membership. Analytical groupings must never be described as official factions.

## Evidence and exports

Pair results retain supporting agreement/disagreement vote IDs. The default example budget is 12 IDs of each kind, explicitly labelled by `evidenceComplete`; `evidenceLimit: Infinity` retains all IDs for offline evaluation. Counts always use all eligible source events regardless of the evidence-example budget. Complete reproducibility uses the matching immutable vote and ballot records under the source manifest. Example links must not be described as the complete denominator when `evidenceComplete` is false.

Exports must include active filters, method settings, units, coverage and manifest identity, and preserve nulls for unavailable ratios. The graph table must retain edge evidence and counts independently of its visual layout.

## Local pilot, 31 October 2026

The local Parliament snapshot generated on 20 October 2026 has 2,800 roll calls from 20 June 2023 through 16 October 2026. The pilot found 478,992 eligible ballots and 78,208 excluded ballots, with no eligible conflicts or duplicates. There were 23,586 observed MP pairs; 22,816 met the 30-ballot threshold. Many leading similarities were exactly 1, illustrating why tied MPs must not be given manufactured individual ranks.

| Matter | Roll calls | Supported pairs | Consequence |
| --- | ---: | ---: | --- |
| HE 109/2024 vp | 813 | 18,500 | Repeated votes on one matter require equal-matter sensitivity. |
| HE 34/2023 vp | 30 | 7,750 | Joint eligibility still removes many otherwise observed pairs. |
| HE 108/2026 vp | 7 | 0 | Every pair remains low support under the declared threshold. |

The default graph contained 2,153 edges and eight components. Community minimum adjusted Rand agreement was about 0.856 across seeds/resolutions and 0.843 across k=3, k=8 and equal-matter variants, below the declared 0.9 target. Community assignments therefore remain unpublished. Brokerage sensitivity was also unstable and ordinal rankings remain disabled. These are substantive negative findings, not missing calculations.

The additional matter bootstrap found 311 document/session blocks. Seeds 11, 29 and 47 sampled 203, 198 and 203 distinct blocks respectively in 311 replacement draws each. Minimum community adjusted Rand agreement against these three bootstrap graphs was about 0.468, strengthening the decision to withhold assignments. All three variants took about 1.1 seconds beyond the supplied base analysis in this workspace.

Full voting analysis ran in about 5.4 seconds in this workspace during the pilot. The unpartitioned JSON was about 18.5 MB; it is an offline intermediate, and browser delivery must use scoped summaries and MP payloads rather than downloading it on the homepage.

Focused fixtures cover abstention/absence/missing ballots, tied modes, party switches, changing group size, duplicates/conflicts, empty periods, equal-matter denominators, tied shortest paths, disconnected normalization, deterministic communities, label-invariant evaluation, and closed publication gates.
