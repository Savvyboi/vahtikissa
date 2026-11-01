# Relationships and shared UI audit, 1 November 2026

The audit checked the production relationships view, MP pagination, the local
implementation, and GitHub Pages configuration. The quoted earlier audit was
treated as a list to verify against the current release.

## Changes in this release

- Localize relationship table headings, captions, analysis statuses, voting
  choices, units, boolean values and keyword matching modes in Finnish/Swedish.
  Use Swedish source titles, voting questions and committee names when present.
- Rename the navigation entry to Verkostot / Nätverk / Networks in the static
  shell and hydrated menu. Explain the distinct meanings of voting, membership,
  speech and lobbying relationships; link separately to declared interests and
  gifts. Add four quick-start buttons.
- Make data columns sortable with native keyboard-operable buttons, visible
  direction indicators and aria-sort. Include party-matrix and source-evidence
  tables. Sort full filtered collections before limiting displayed rows; keep
  missing values last and stable ties. Use unrounded numeric source values.
  Exports follow table order and retain the sort settings and provenance.
- Add a show-more control for long relationship/evidence tables, alternating
  row shading and localized numbers. Keep speech/declaration actions working
  after sorting. Do not offer evidence actions for speech rows without matches;
  missing-corpus rows previously attempted to load undeclared month files.
- Show roll-call IDs and official voting alternatives in detailed/simple vote
  lists and MP feeds. The HE 69/2026 votes on 21 October are distinct recorded
  votes: the alternatives identify Hanna-Leena Mattila's statement proposals
  1 and 2. Preserve those separate votes and their source totals.
- Set explicit pagination text color, readable numeric typography and localized
  page-button names. Clamp MP pagination to the available pages after filtering.
  The original missing-number report did not reproduce on the tested current
  production pages; tests now cover numeric-button contrast in all three themes
  at 320px, 390px and 1440px, as well as actual page changes.
- Add literal whitespace between overview figures and labels, vote titles and
  references, navigation links, topic badges and committee badges. Committee
  acronyms now expand to the full localized name with a native disclosure on tap
  or keyboard activation, in addition to their existing hover title.
- Enable GitHub Pages HTTPS enforcement. The existing certificate was approved,
  but the enforcement setting was disabled.

## Findings already addressed before this release

The current production navigation already translated following and relationships
in FI/SV/EN. Gift value sorting, parliamentary-term/year filtering, shareable
disclosure settings, collapsed advanced/exclusion filters, party badges and
theme-aware logos were also already implemented. These were not rebuilt.

Parliament data is already split into route-specific shards. Relationship
analysis is loaded only on its route; the homepage does not fetch relationship
analysis modules or datasets. The existing loading deadline, retry behavior and
performance budgets are retained.

## Follow-up requiring other infrastructure or a broader change

- **www DNS:** www.vahtikissa.fi returned NXDOMAIN. The authoritative name servers
  are Namecheap FreeDNS (registrar-servers.com). Its DNS administrator needs to
  add a CNAME for www pointing to savvyboi.github.io; GitHub Pages can then apply
  the configured custom-domain canonical redirect. DNS account access is not
  available in this repository or its connected deployment workflow.
- **Real page URLs:** hash routes remain in use. History paths and individually
  indexed/social-preview pages need a separate routing/HTML delivery migration,
  preserving existing links. No blanket hash redirect was added.
- **Bill summaries:** this change exposes official voting alternatives already
  stored in the dataset. It does not invent plain-language bill summaries or
  infer what a vote meant beyond the source alternatives.
- **Navigation regrouping:** the existing responsive menu is retained. A new
  four-category information architecture would require a broader navigation
  change; it is not necessary for the confirmed translation/sorting bugs.

Lobbying records remain declared organisation/topic/target associations, not
meeting counts or an influence score. Existing scientific publication gates,
independent human-review requirements and immutable source evidence remain intact.

## Validation

- `npm run check`: 271 tests and all source/data validators passed.
- `node scripts/check-network-browser.mjs`: all 14 analyses, FI/SV/EN headings,
  numerical sorting and matching exports, sorting beyond 300 rows, source actions,
  missing-corpus handling, matrix/evidence views, mobile layouts and theme checks
  passed. MP number buttons meet 4.5:1 text contrast in all tested themes/sizes.
- `node scripts/check-browser.mjs`: the full interaction, responsive and
  accessibility suite passed. The research permalink check now waits for the
  destination route before checking its asynchronously computed results.
- `node scripts/check-release.mjs`: release regression checks passed.
- `node scripts/check-performance.mjs`: homepage/scoped-loading budgets passed;
  detailed-home JavaScript is 226,869 bytes, below the 230,000-byte limit.
- `node scripts/validate-network-analytics.mjs`: all 8,063 immutable payloads,
  sampled pair reconstructions and publication gates passed.
- Public HTTP verification returned `301 Location: https://vahtikissa.fi/` after
  enabling HTTPS enforcement.

Browser checks used the installed Microsoft Edge channel. No dependency or
scientific calculation changes were needed.

## Mobile source follow-up

The supplied phone screenshots identified two problems missed by the original
viewport-only checks. Source content loaded into a section roughly 4,600 pixels
below the visible mobile screen, and wrapping action labels could split into
individual letters while five speech buttons made each row unnecessarily tall.

Source actions now open a native, labelled dialog with immediate loading feedback,
retry, a persistent close control, Escape support and focus/scroll restoration.
Speech samples use one compact count button and a numbered source selector inside
the dialog. Closing before a request finishes prevents a late response from
reopening the source. The clicked speech's own month selects its immutable payload.

The failed Actions run was `41324278675`, job `124900829506`: its pagination
contrast assertion read colors during a theme repaint. The check now waits for
two animation frames and reports measured foreground/background values on a real
failure, while retaining the 4.5:1 requirement. This was reproduced with the same
pinned Chromium version as CI, in addition to the installed Edge browser.

`scripts/check-relationship-mobile.mjs` is included in CI and uses mobile/touch
emulation at 320px and 390px. It checks compact labels, visible source content,
speech selection, FI/SV/EN, both reading views, dialog accessibility, focus/scroll
restoration, close/Escape, late responses and network-failure retry.
