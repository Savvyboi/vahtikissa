# Relationships transparency explorer

Open `http://localhost:4173/?view=full#/relationships` after `npm run dev`.
`?view=simple#/relationships` opens the structured, card-first version. Mobile
screens also start with cards and download the graph renderer only when opened.
The explorer is published through the repository's existing GitHub Pages workflow.

## Repository audit

| Concern | Existing implementation | Integration |
| --- | --- | --- |
| Interests, gifts, lobbying | `scripts/sync-civic-data.mjs` → `data/influence.json`: `interests`, `gifts`, `lobbying`, `targets` | Consumes the existing local snapshot; does not fetch or invent records |
| MPs and HE matters | `scripts/sync-data.mjs`, `data/parliament.json` | MP identities, current party, stored bill titles and routes |
| Minister terms, districts, committees | `scripts/member-profiles.mjs`, `data/member-profiles.json`, `data/committee-index.json` | Snapshot cabinet parties, membership intervals, districts and committee labels |
| Relationships route | `app.js` → `relationships-app.js` | New default explorer; existing explicit `feature` links still open all prior voting/speech analyses |
| Shared include/exclude logic | `collection-tools.js`: `matchesSelection`, `mountCollectionTools` | Same controls and state shape; OR within a group, AND across groups, exclusions first |
| Themes | `styles.css`, `app.js` → `html[data-theme]` | `transparency-explorer.css` defines graph colours; a theme observer repaints the live canvas |
| Easy view | `reading-mode.js`, `simple-mode.js`, `app.js` | Receives the existing `view` argument; structured cards and an explicit canvas toggle |
| Static hosting build | `npm run build:data`, `server.mjs` | Adds the transparency precomputation to existing local/Pages build entry points |

## Implementation and commands

- `scripts/transparency-graph.mjs`: canonicalisation, multiplex aggregation,
  exact normalized Brandes betweenness, weighted PageRank, weighted Louvain,
  deterministic offline d3-force coordinates and both one-mode projections.
- `scripts/build-transparency-graph.mjs`: fingerprints inputs, writes immutable
  graph/evidence files, verifies unchanged sources and atomically updates the index.
- `transparency-model.js`: compact static encoding, decoding, shared faceting,
  projections, backbone selection, viewport coordinates and bounded BFS paths.
- `transparency-explorer.js`: presets, shared filters, drawer, tables/cards,
  heatmap, bill links, responsive fallback and exports.
- `transparency-canvas.js`: locally vendored [Cytoscape.js](https://js.cytoscape.org/),
  hover spotlight/particles, group hulls, keyboard pan/zoom, animated preset
  transitions, expansion/pruning and image exports. No force or centrality
  calculation runs in the browser.

```sh
npm ci --ignore-scripts
npm run dev
npm run build:transparency
npm run test:transparency
npm run validate:transparency
npm run test:transparency-browser
npm run audit:transparency-sources -- --fetch --all
```

The existing `npm run build:networks` and `npm run build:data` also generate this
dataset. Generated files remain under the existing ignored `data/networks/`
directory. CI installs the pinned dependencies and tests the explorer in a
dedicated browser check. Deployment verification covers its renderer and graph index.

The optional source audit downloads official member responses and closed lobbying
periods into `.hermes-tmp.transparency-review/`. Without `--all`, it downloads eight
representative MPs and the latest closed period; without `--fetch`, it rechecks
the saved responses. It compares actual source fields, exact target IDs, original
gift text, amounts, declaration/use dates, membership intervals, snapshot parties
and source coverage. It is separate from schema/hash validation and does not
authenticate the truth of a declarant's claims. See
[`transparency-review-2026-11-02.md`](transparency-review-2026-11-02.md) for the release audit.

## Static data and reproducibility

`data/networks/transparency.json` points to a content-addressed directory:

```text
data/networks/transparency-<snapshot-id>/graph.json
data/networks/transparency-<snapshot-id>/evidence.json
```

The index includes SHA-256 digests for both files and every source/method input.
The browser verifies graph and evidence hashes and snapshot IDs. Evidence is
loaded on first inspection and remains pinned to that graph version.

The `multiplex-1` graph encoding shares record metadata in `recordIndex`.
Packed edges contain source/target node indices, their precomputed weight and
detail references. `unpackTransparencyGraph` restores the rich edge schema:
counts, layers, weights, HE IDs, periods, multiplex status and typed provenance.
Each detail references the full original disclosure in `evidence.json`. This
avoids repeating whole topics for every named MP and committee member.

The full graph is about 7 MB before transport compression in the current source
snapshot. The initial map shows at most 100 actors and 200 strongest ties.
Explicit expansion reveals hidden neighbours. The broker view reserves up to
30 places for MPs and 30 for organisations, then shows a sparse set of strong
ties; an MP-only top-60 ranking would contain no bipartite edges. Global metrics
still describe the full graph. All matching records remain available below the map.

## Interpretation and limits

- Y-tunnus takes precedence. Legal-suffix-normalized names match to a business
  ID only when unambiguous. Conflicting business IDs remain separate. This does
  not resolve every alias, bilingual name or group/subsidiary distinction.
- Role extraction accepts short organisation/role declarations, including
  role-first text. Ambiguous narratives, aggregate assets/debts and income
  disclosures are omitted. The coverage panel reports omissions. Automatic
  role extraction and category heuristics should be checked against the source.
- A board flag requires explicit board, supervisory-board or executive-board
  wording. The broader administrative category, municipal councillor status
  and delegate roles alone do not establish a board interlock. Those parsed
  non-board roles remain ordinary interest ties.
- People are matched by exact, unique full name. Ambiguous names and targets
  absent from the member snapshot are omitted and counted; ministers already
  represented in the parliamentary member snapshot are included.
- A lobbying count is a distinct disclosed topic record, not a meeting or a
  proven personal contact. Closed reporting periods are retained verbatim.
  Gifts show the disclosure date and the source's period of use separately.
  Original multiline gift text is reparsed during graph construction so old
  snapshots with missing derived donor fields do not silently lose the tie.
  Unknown amounts stay unknown. The final appended use-period field is kept
  separate even when a description itself quotes that field label.
- Committee-derived ties require an ordinary membership overlapping the source
  reporting period. Substitutes are excluded from this inference. These ties
  are labeled, dotted and can be switched off. They do not assert personal contact.
- MP interlocks require a shared board organisation and common disclosure year.
  The sources do not establish simultaneous board service or a shared meeting.
- Organisation coalitions contain the top 150 pairs sharing an exact HE ID or
  identical nonempty committee set. These are shared targets, not proven coordination.
- PageRank and betweenness measure graph position. They do not establish
  lobbying success, causation, improper conduct or political power.
- Centralities remain relative to the full snapshot after filtering. Party,
  cabinet-bloc and committee facets use snapshot membership. Cabinet parties
  are derived from active ministerial terms, not a hardcoded current-government list.
- E–I for MPs compares unique cross-party and same-party board peers. For an
  organisation it compares cross-bloc and same-bloc pairs among connected MPs.
  It is zero when there are too few ties to compare.
- Period filtering selects disclosures before recomputing visible edge counts
  and weights. Other facets operate on that resulting edge. Projection support
  must survive the same filters; filtered-away board records cannot create an interlock.
- HE mentions are exact textual references. Links open existing legislation
  routes only when the bill exists in the stored collection; speech search is
  also available. An HE association does not assert a voting position.
- The column view adds snapshot committee memberships as a separately labeled
  structural layer; the bill preset instead uses a third HE column. These
  structural edges do not increase disclosure counts or offline centrality.

PNG, SVG and JSON exports describe the currently displayed graph. JSON includes
snapshot ID, filters, expansion/pruning state, selected path, theme and viewport
coordinates. Layout geometry has no analytical meaning.

The default route stays `#/relationships`. Non-default preset, layout, metric,
filters and ego choices are serialized into the URL; expansion/pruning and
viewport details are in JSON exports. Evidence includes declared recipient IDs,
names, consultant clients and organisation matching provenance. Lobbying links
use the official `/diary-number/` endpoint. Mobile cards remain the default;
optional tables and the party matrix keep their column headings and scroll
within a focusable region.
