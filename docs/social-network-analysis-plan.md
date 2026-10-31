# Parliamentary networks: implementation options

Planning proposal, 30 October 2026. Data figures below describe the local snapshot refreshed on **20 October 2026**, rather than a new source refresh.

For implementation, use the [coding-agent plan and selectable scope](social-network-coding-agent-plan.md). Its feature checklist, or the complete selection supplied in a generated handoff, is authoritative; this document is research background.

**Recommendation:** start with voting relationships, comparative keyword trends, and inspectable cross-party connections. Then add committee overlap and topic attention profiles. Treat directed attention, phrase uptake, and lobbying networks as separate later modules.

## 1. What the existing data supports

| Available data | Local coverage | What it enables |
| --- | --- | --- |
| Individual ballots | 2,800 roll calls; 557,200 ballots; 219 tracked MPs | Voting similarity, cohesion, cross-party alignment, changes over time |
| Full speeches | 40,501 transcripts across 439 sessions | Topic attention, vocabulary, observed phrase uptake, extracted references to other speakers |
| Parliamentary matters | 7,533 matters; 40,464 speeches link to a stored matter | Compare speech and voting around the same issue rather than only broad themes |
| Committee information | Official committee tags for 2,733 votes; dated MP committee/body histories | Issue filters and institutional co-membership networks |
| Lobbying declarations | 11,861 declared topics; 129,114 reported target associations | Organisation–topic–recipient networks, with reporting-period resolution |
| Gifts, interests, programmes, elections, budget | Existing separate collections | Context and optional later affiliation layers; each needs its own relationship definition |

The earliest stored speech is 25 April 2023 and the earliest roll call is 20 June 2023. Coverage differs between layers. There are 23 speeches by non-MP officials without a matching MP ID; we should explicitly include them as separate speakers or exclude them from MP-only measures.

We already have transcript search, source-linked excerpts, distinctive MP word clouds, monthly keyword rates per 10,000 words, party-line statistics, and a static data-build pipeline. New work should extend those foundations. The current “influence” section is a disclosure browser; it does not currently measure network position.

## 2. Define several networks with distinct meanings

A relationship should always answer “what does this line mean?” Keep these layers individually selectable, with a shared person/matter identity model. Overlaying layers can come later; adding their scores together would require a separately justified model.

| Layer | Nodes and relationship | Questions it can answer | Interpretation |
| --- | --- | --- | --- |
| Voting | MP ↔ MP, weighted by agreement on shared eligible ballots | Who votes alike? Where does cross-party alignment appear? | Behavioural similarity |
| Issue participation | MP ↔ matter/topic, weighted by participation or share of attention | Who focuses on which issues? Which issues connect parties? | Shared attention; opposing positions may share an issue |
| Institutional | MP ↔ committee/body during a valid membership interval | Who has overlapping institutional access? Who spans several policy areas? | Opportunity for interaction |
| Directed attention | Speaker → named MP, with supporting text | Who attracts references, challenges or responses? | Observed attention, after extraction is validated |
| Declared lobbying | Organisation → declared topic → reported target | Which organisations report targeting which people and issues? | Self-reported association within a reporting period |

Social network theory supplies several useful lenses: **homophily** (similar actors clustering), **cohesion** (dense groups), **brokerage/structural holes** (connections spanning groups), **centrality** (position within a particular layer), and **diffusion** (patterns of adoption over time).

Call the public-facing results “voting alignment,” “cross-group connections,” “topic attention,” or “references received.” A universal “most influential MP” score would obscure what the evidence actually measures. Shared preferences, party discipline and shared external events can all produce similar behaviour; observational network patterns alone do not identify persuasion. See [Shalizi and Thomas, 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3328971/).

## 3. Feature menu

### A. Voting relationships — first release

**User question:** “Who does this MP vote with, and does that change by issue?”

- Start with an MP’s nearest voting neighbours and a party-to-party agreement heatmap. Add an optional MP network once the measures are interpretable.
- Compute agreement as matching choices divided by jointly eligible votes in the selected window. Exclude absence and unknown ballots; keep abstention as an explicit choice, with a yes/no-only sensitivity view. Show the shared-vote count beside every percentage.
- Offer whole-period and topic/committee/date views. Include an all-votes baseline and a clearly defined contested-votes comparison.
- Check whether repeated amendment votes on one matter/session dominate results; offer an equal-matter weighting comparison.
- Use each ballot’s recorded party, rather than applying the MP’s present party to the past. For the party heatmap, compare each party’s unique modal choice per roll call, excluding tied or missing party positions; show within-party cohesion separately. This avoids larger parties dominating through a greater number of MP pairs.
- Clicking a relationship opens the votes contributing to agreement and disagreement, including the official alternatives.

**Gate:** if MPs within parties are effectively indistinguishable, show that result. Do not manufacture an individual ranking from tiny differences.

### B. Cross-party bridges — first release, with a narrow meaning

**User question:** “Whose recorded connections extend beyond their own group?”

- Initially show the strength and breadth of cross-party voting alignment, relative to available counterpart groups and their contemporaneous active membership sizes.
- Later compare the same person’s institutional overlap and topic attention across groups. Someone can bridge topic communities without bridging voting blocs.
- Candidate measures are cross-group tie share, participation coefficient (how broadly ties are distributed), and betweenness on a documented sparse graph. Use separate measures with plain-language explanations.
- Betweenness depends on the selected edges and distance definition. Similarity is not distance: document the transformation, test thresholds/neighbour counts, and handle disconnected components explicitly. [NetworkX’s definition](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.centrality.betweenness_centrality.html) makes this distinction explicit.
- Show which parties, topics or committees account for a result, with supporting records and a stability indication.

**Gate:** a high score describes a position in that network. On a voting-similarity graph it does not demonstrate that communication or negotiation passed through that MP.

### C. Comparative keywords and topic trends — first release

**User question:** “What is gaining attention, and how does it differ across parties?”

- Extend existing monthly keyword summaries into charts comparing selected parties or MPs.
- Show rates per 10,000 words alongside raw mentions, matching speeches and distinct speakers. Also offer the share of speeches mentioning a term, so one long speech does not determine the story.
- Add rising/falling phrases using a declared comparison window, minimum support and uncertainty. Respect recesses, partial months, corpus gaps and differing activity levels.
- Separate overall attention from breadth: is a rise concentrated in one MP, one party, or spreading across several groups?
- A chart point opens source-linked excerpts with the same query, filters and denominator.
- Begin with transparent keyword/phrase groups. Current Finnish/Swedish token handling is not full lemmatization; evaluate morphology, language identification and cross-language concept mapping before treating linguistic similarity as conceptual agreement.

**Gate:** current broad topic tags are metadata-based heuristics. A topic match does not establish a stance, and changing the definition of a term must create a new method version.

### D. Committees, attention profiles and communities — second release

**User question:** “Which institutional or issue groups overlap, and who spans them?”

- Build MP–committee membership with overlapping start/end dates, distinguishing full membership, substitutes and chairs where recorded. Canonicalize historical body names and deduplicate overlapping records.
- Retain the two-mode MP–committee structure. If projecting to MP pairs, weight shared time and adjust for committee size so a large body does not create artificially strong ties.
- Build MP–matter/topic attention profiles using participation rates or within-MP shares. Retain links to the actual matters and speeches.
- Compare voting, institutional and topic neighbours on MP profiles: “similar voting, different attention” and “shared issues, different votes” are useful discoveries without asserting inconsistency.
- Explore communities only after validating the underlying features. Existing broad topics are too coarse to promise meaningful emergent groups. Use a bipartite-aware model or a documented popularity-adjusted projection, rather than clustering an arbitrary projection.
- Where appropriate, evaluate Leiden with repeated seeds and resolutions, compare with known party structure, and publish stable groupings only. Its connectivity properties are described by [Traag, Waltman and van Eck, 2019](https://arxiv.org/abs/1810.08473).

**Gate:** committee overlap means institutional proximity. It does not prove that two MPs worked together on a specific matter. A detected community is an analytical grouping, not an official faction.

### E. Attention and observed phrase uptake — exploratory later work

**User questions:** “Who gets discussed?” and “Where did an expression first appear in our records?”

- Extract explicit references, quotations and possible replies into directed edges, retaining the source passage and extraction confidence.
- Distinguish an address, criticism, quotation and endorsement where evaluation supports it. A response speech type currently has no explicit reply-to person; speech order alone cannot supply one.
- Use incoming references and breadth of referring speakers as attention measures; evaluate PageRank only if the directed graph supports a useful interpretation.
- For phrases, show first observed use in this corpus, later speakers/parties using it, and recurrence across independent matters and dates.
- Treat chronological phrase uptake as an observation. It is not a person-to-person transmission edge unless an explicit reference supports that connection. Shared news events, party talking points, copied quotations and scheduled debates are alternative explanations.

**Gate:** validate extraction on a human-reviewed sample before publishing people rankings. The start of our archive limits any “first use” claim. General sentiment scores are insufficient for classifying political relationships.

### F. Declared lobbying network — separate later module

**User question:** “Which organisations report approaching the same MPs or policy areas?”

- Build organisation–topic–target relationships from closed reporting periods. Deduplicate by declaration, topic and target; never label target associations as meetings.
- Identify organisations by company ID rather than display name. The snapshot has 839 organisation labels but 817 company IDs.
- Create a reviewed target-to-person crosswalk before MP rankings. Target IDs can vary across periods, and the current interface relies on normalized names; unmatched or ambiguous identities stay visible as unresolved.
- Compare distinct organisations, issues and reporting periods; optionally show overlap between target sets. Preserve non-MP targets separately.
- Link to official declarations. Current coverage runs from April–June 2024 through January–June 2026, and period-level dates cannot support precise before/after speech claims.

**Gate:** declarations describe reported contact associations. Neither centrality nor a nearby vote establishes lobbying effectiveness. Gifts and money should retain their own units and provenance rather than becoming a combined influence score.

## 4. Delivery sequence and decision points

Effort below is relative, not a calendar commitment. Multilingual explanations, accessible interaction and source inspection are part of each feature.

| Step | Reviewable deliverable | Relative effort | Decision after review |
| --- | --- | --- | --- |
| 0. Foundations | Coverage report; event-time identities; documented edge definitions; sample outputs from several issues | Small–medium | Are the measures meaningful enough to expose? |
| 1A. Voting | Neighbour cards, agreement heatmap, source votes and time/topic filters | Medium | Does individual detail add information beyond parties? |
| 1B. Trends | Comparative charts, normalized rates, breadth, excerpts and exports | Medium | Which keyword families and comparison periods are useful? |
| 1C. Connections | Cross-party connection summaries with counts and stability checks | Small–medium after 1A | Are results robust enough to rank, or better shown as profiles? |
| 2. Institutional/topics | Dated committee overlap, attention profiles, comparison across layers; communities if validated | Medium–large | Which layer deserves a full network explorer? |
| 3. Experimental modules | Separately reviewed lobbying, directed references or phrase-uptake prototype | Large; choose independently | Does extraction/identity quality justify publication? |

**Suggested first scope: 1A + 1B, followed by 1C if the voting graph contains meaningful variation.** This gives users immediately inspectable results while establishing the evidence and filtering tools needed for later networks.

## 5. Fit with the current application

- Add an offline builder, provisionally `scripts/build-network-analytics.mjs`, using the existing snapshots and transcript chunks. No graph database or visitor-time AI calls are needed for the first release.
- Emit a versioned network index plus small layer/period payloads under a proposed `data/networks/` directory. An analysis manifest should identify each exact source component by snapshot/hash, alongside method versions, windows, exclusions and coverage. Parliament, profiles and lobbying refresh independently, so their timestamps need not match; all payloads and evidence must match the declared manifest.
- Integrate generation and validation into the existing sync/build process. If an analysis fails, retain the last valid output together with its matching evidence, or mark that analysis stale/unavailable; do not open revised evidence behind an old score.
- Precompute supported periods and neighbourhoods. Compute arbitrary date/topic combinations only after measuring browser costs; avoid precomputing every possible filter combination or downloading all ballots/transcripts on the homepage.
- Use a “Relationships” research view, with shared date/topic/party filters and an MP-focused entry point. Provide heatmaps, tables and small ego networks before a dense whole-Parliament diagram.
- Every node, relationship and chart result opens evidence. Include a table equivalent, keyboard access, mobile layouts, reduced motion, source timestamps, filter-preserving links and CSV/JSON exports.

Relevant existing foundations: [ingestion](../scripts/sync-data.mjs), [member histories](../scripts/member-profiles.mjs), [speech research](../speech-research.js), [speech research UI](../speech-research-app.js), [speech analytics build](../scripts/build-speech-analytics.mjs), [browser payload builder](../scripts/build-parliament-data.mjs), and [data audit](data-audit-2026-10-20.md).

## 6. Acceptance criteria

1. Pair agreement is symmetric, uses the correct common-vote denominator, and excludes shared absence. Event-time party changes and changing rosters have explicit fixtures.
2. All published results reconcile with source records and one reproducible analysis manifest. Unknown identities, missing dates and insufficient observations are labelled rather than scored as zero. Calibrate and publish minimum evidence thresholds during the pilot; a period with no corpus words has an unavailable rate.
3. Repeated ballots and speeches on one matter do not create false precision: assess stability by resampling matters/debates and by changing reasonable windows, thresholds and weighting rules. Report association stability rather than confidence in causality.
4. Bridge/community results are compared with party-size and activity baselines. If small methodological changes reverse a ranking, suppress the ranking or show its instability.
5. Trend totals reproduce existing query exports; rates use the selected corpus before the positive query. Language, partial-period and low-support cases have visible handling.
6. Any inferred text relationships pass a predeclared precision target on a reviewed sample before public rankings. Hypotheses discovered among many keywords are labelled exploratory unless separately confirmed.
7. A reader can explain what an edge means, inspect its evidence and use the result without manipulating a graph. Existing page-loading and accessibility checks continue to pass.

## 7. Options to select for implementation

Selection now lives in the [coding-agent implementation checklist](social-network-coding-agent-plan.md#1-choose-the-implementation-scope), with independently selectable features, calculation dependencies and acceptance criteria. Use that checklist or a complete generated handoff so there is only one authoritative selection per implementation run.
