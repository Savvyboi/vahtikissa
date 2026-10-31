# Speech relationship methods

Method version: `speech-network-1`; explicit reference extractor: `explicit-reference-1`.

The functions in `network-speech.js` work offline with existing speech metadata and original transcript strings. They do not refresh sources or use model inference. The main analysis manifest records hashes of the inputs; original full transcripts remain the evidence source. All returned excerpts are plain data and must be escaped by a renderer.

## Keyword comparisons

`compareKeywords(speeches, texts, settings)` accepts the existing `query`, `exclude`, `mode` (`contains`, `word`, `phrase`) and `scope` (`text`, `all`), together with `dateFrom`, `dateTo`, `party`, `mpId`, `topic`, `coverageStart` and `coverageEnd`. `groups` is an array of `{id,label,party}` or `{id,label,mpId}` selectors; an empty selector means the entire selected corpus. Recorded speech party is used, including party changes.

Positive query matching, exclusions, punctuation/case normalization and non-overlapping matches reuse `speech-research.js`. The denominator is the filtered corpus after exclusions and before applying the positive query. Monthly outputs include occurrences, matching speeches, words, distinct matching speakers, party breadth, per-10,000-word rates and speech prevalence. Metadata-only hits appear separately and do not contribute transcript occurrences or prevalence. A month without words has a `null` word rate; a month without speeches has `null` prevalence. Missing calendar months are emitted explicitly. Months cut by requested or archive bounds are marked partial. A coverage gap can be a recess or missing collection: the method does not distinguish these without additional evidence.

The word denominator exactly follows existing research normalization, including its treatment of numeric tokens. No stemming or Finnish/Swedish equivalence is inferred. Empty positive queries produce no mentions. Speaker breadth includes separately named external speakers; topic profiles are MP-only.

## Emerging terms and phrases

The default comparison uses the two complete calendar months preceding the archive's final month against the preceding two months. Explicit non-overlapping `baselineStart`, `baselineEnd`, `recentStart`, `recentEnd` may replace this choice. The final archive month is excluded by default, even when its actual end happens to be a month end, keeping the rule predictable.

Candidates are contiguous one- or two-token expressions, with each token at least four letters and outside the existing versioned FI/SV stopword set. Punctuation is normalized; phrases are not lemmatized and languages are not merged. Repeated same-token bigrams use the existing non-overlapping matching rule. A two-pass implementation first counts document frequencies, then collects speaker/party breadth and evidence for expressions that could reach the threshold. No sampling or truncation changes counts.

A candidate requires at least five occurrences, three distinct speakers and two recorded parties in at least one window. Results are the 30 candidates with the largest absolute change in word-normalized rate; ties use lexical ordering. Both windows show raw support and breadth; the weaker window is explicitly labelled low support. Zero observed baselines retain a `null` ratio and a finite rate change, while a window without corpus words is unavailable. Missing months, partial coverage and window speech/word activity remain visible. Recesses are not imputed. These are exploratory candidates selected among many expressions, without a significance or causal claim. Defaults are configurable for pilot/tests and exported in the result method.

## Topic profiles

`buildTopicProfiles` retains the existing metadata-derived discovery tags and original matter identifiers. It reports per-MP speech and word totals, within-MP topic shares, each MP's share of topic speeches, and per-matter participation. Tags can overlap, so shares across topics may sum above one. Word shares have a `null` denominator when the MP has no words. Raw counts do not create a ranking of substantive influence; shared attention does not identify stance. Speeches without an MP identity are excluded from MP profiles and counted in coverage. Missing dates are excluded from time-filtered analysis.

## First-observed expression use

`phraseUptake` reuses normalized matching and defaults to exact phrases. Dates are compared as absolute instants and emitted in UTC; simultaneous first uses remain tied. The archive start and end, later uses, recurrence dates, distinct matters and speaker/party breadth are retained. Quotation markers are a descriptive flag; quoted expressions are neither removed nor classified as original authorship. This is first observed use in the stored corpus, not authorship. Chronology never creates transmission edges.

## Explicit references and the publication gate

Extraction requires either a full recorded name or an explicit nearby MP/minister title plus a surname. A limited, declared set of transparent surname suffixes is recognized. Same-surname candidates remain ambiguous unless a matching first name disambiguates them. The extractor preserves source offsets, passages, candidate identities, visible negation/quotation markers and self-reference candidates. Confidence labels describe rules, not calibrated probabilities. Response-speech type, transcript order, sentiment, endorsement and addressee are never inferred.

The policy is declared before evaluation: at least **100 independently human-reviewed automatically resolved references**, with the **lower Wilson 95% confidence bound on correct source-to-target precision at least 0.95**. The default review sample has up to 240 entries, deterministically interleaved across ambiguity and rule strata after stable hashed ordering. The sample is fixed by the extracted corpus. Every sampled case must be reviewed, including ambiguous and invalid references. Precision is conditional on automatically unambiguous candidates; ambiguous candidates have a separately reported reviewed count and remain excluded from person measures. The stratified precision is conservative with respect to the fixed evaluated sample and is not presented as a prevalence estimate for all mentions. Reviewers must verify person identity and explicit reference against the full transcript, not only the excerpt. Labels with unknown candidate IDs, duplicate IDs, missing reviewer identity, non-human declarations or invalid targets are rejected.

The extractor always returns `publicPersonRankingsEnabled: false`. Evaluation keeps it disabled unless the unchanged sample, minimum support and precision bound all pass. It never invents independent review. After a genuine pass, attention output covers only the independently reviewed, valid, resolved references; it does not extrapolate those counts to all extracted candidates or infer political influence. Incoming count, distinct referring speakers and source-speech IDs remain separate.

Create a blank review artifact (new output path required). Replace `MANIFEST_ID` with the ID in `data/networks/index.json`:

```powershell
node scripts/network-reference-review.mjs sample data/networks/MANIFEST_ID/reference-extraction.json work/reference-review.json
```

An independent human must complete `valid`, `targetMpId`, `reviewer` and `independentHuman` in every sample entry. Agent labels are not independent human review. Evaluate without modifying the fixed sample:

```powershell
node scripts/network-reference-review.mjs evaluate data/networks/MANIFEST_ID/reference-extraction.json work/reference-evaluation.json work/reference-review.json
```

The CLI refuses to overwrite existing outputs, preserving human labels. Each review template contains a SHA-256 digest of the canonical complete candidate records, the fixed sample IDs, source/evaluation policies, extraction method and source manifest ID when provided. Evaluation rejects missing bindings and any changed corpus, candidate passage, identity, method or manifest, even if speech IDs and source offsets happen to remain unchanged. Merely generating a template never opens publication. Source hashes, method version and the fixed sample must be retained with any eventual review artifact.

## Payloads and verification

`buildSpeechAnalysis` returns coverage, method, topic profiles, emerging candidates, four initial query comparisons (`ilmasto`, `talous`, `koulutus`, `turvallisuus`), their first-observed timelines, and reference extraction/review tooling. The initial terms are transparent query presets, not validated cross-language concepts. Supporting ID lists are complete; each aggregation carries at most five excerpt examples. Builders should split full IDs and reference candidates from summaries and keep original transcripts in scoped evidence payloads. Arbitrary text queries should run only after an explicit request loads a bounded speech period, never download the whole transcript archive on the homepage.

`node --test tests/network-speech.test.mjs` checks denominator parity with existing aggregation, exclusion/metadata semantics, event-time parties, missing and partial periods, UTC ties, repeated quotations, topic normalization, breadth versus repetition, absent/zero baselines, overlapping phrase counts, ambiguous references and genuine review gates.
