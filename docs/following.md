# Browser-local following

Open an MP's public page and choose **Seuraa edustajaa / Följ ledamoten / Follow MP**. The main navigation's **Seuratut / Följer / Following** page combines those MPs with the programme themes already followed in this browser. The feature works in both reading modes, Finnish/Swedish/English, and all three colour themes. Theme controls on votes, proposals and programmes use the same selections.

No account, server-side visitor identity, preference endpoint, notification service or AI generation is involved. Preferences stay in local storage on the current browser origin. They do not synchronize automatically across devices, browsers or domains; clearing site storage removes them. Export/import provides a manual transfer option.

## What “newly observed” means

A visit is one loaded document. Hash navigation, language changes, colour changes and reading-mode switches remain the same visit. Reloading the document starts a new visit.

Each selected MP's votes and speeches has its own source baseline. Each selected theme's votes and proposals has its own baseline; optional gifts and lobbying also have independent baselines. A complete, validated load in Following records that source's stable record IDs and the browser's observation time. The first such load seeds the comparison without marking historical records new. A source not loaded in Following has no baseline yet, even if its records were read elsewhere.

On subsequent visits, an ID never observed in that source before the visit is **newly observed**. Comparison IDs are frozen for the current visit, so rerenders and later successful refreshes keep the same indicators. New additions during the first visit compare against its initial successful load. Previously observed IDs remain in the comparison history, including records temporarily removed from a later snapshot; their reappearance is not a new observation. Changes to the text or metadata of an existing ID are not marked new. Unfollowing and refollowing does not erase that source's comparison history.

Source dates and browser observation times are displayed separately. A backfilled record can have an old parliamentary date and a new browser observation time. A new AI tag association can newly connect an existing vote or proposal to a followed theme; this is an observation in the theme's source, not a newly published parliamentary event. Theme sections show both parliamentary and AI snapshot timestamps. Identical snapshot/ID sets reused during rerenders retain their observation time.

Successful observations are saved for the next document visit immediately, without requiring readers to open each record. Indicators are not unread counts or read receipts. Reloading after a successful observation therefore clears its new indicators. If a newer refresh arrives during the visit, additions remain new relative to the visit's frozen comparison.

Sources advance independently. Network errors, mixed snapshot versions, missing arrays, duplicate IDs, mismatched MP IDs and detectable truncated collections are unavailable sources, not successful empty results. They do not advance their comparison history. One failing source does not hide successful sources. Parliament member shards must match the core snapshot and published activity totals; theme proposal collections must match the core snapshot and published count. Validation cannot prove that an upstream publisher supplied every real-world event.

**Check latest snapshot** reloads the Parliament core and AI index and retries the selected sources. It also clears the optional civic snapshot cache. It does not change the visit's frozen comparison. No timer polls for updates. A failing core load uses the existing page-level retry; failed individual sources can be retried from Following.

## Sources and limits

- MP voting activity uses recorded ballots linked by Parliament MP ID to the complete vote catalogue. Recorded absence is included and is not evidence of the reason for absence. Speeches use the MP's complete metadata shard; full transcripts load only on their existing public pages.
- Programme themes reuse `vahtikissa-ai-tags`. Only fingerprint-valid, already analysed AI associations connect current source votes/proposals. Unanalysed and stale-tagged records are omitted. Shared themes do not establish party support, causation or fulfilment of a promise. No AI work is triggered by Following.
- Gifts and lobbying are optional because their shared snapshot is about 9 MB. Gifts use explicit MP IDs. Lobbying uses the existing unique exact full-name match against targets classified as MPs, never assistant or partial-name matches. This association is stated in the view. Reporting periods and disclosure dates are not exact contact dates; declared contacts do not demonstrate influence over decisions.
- Original source URLs are preserved. Where the gift/lobbying snapshot provides only a dataset-level URL, that original source is used. The feed retains source record IDs and links to existing public detail/filter pages. The snapshots are compiled public data, not a complete real-time feed. Missing records do not establish absence of activity.
- Ten records per source are initially shown, ordered with newly observed records first and then by source date; **Show more records** reveals the remainder. Counts compare the complete successfully loaded source, not only visible rows. The same vote may appear under several followed MPs or themes; totals count source observations, not globally deduplicated events.

## Storage, transfer and removal

MP IDs use `vahtikissa-followed-members`; theme IDs remain at the legacy `vahtikissa-ai-tags` key. The versioned `vahtikissa-following-snapshots` value contains only source IDs, observed record IDs, source versions and browser observation times. It is local comparison state, never sent to a preference service or included in exports. Comparison history is bounded at 100,000 IDs per source; browser quota can impose a smaller practical limit.

Removing one selection or all selections leaves comparison history available if it is followed again. Clearing the browser's site storage removes both selections and comparison history. Export is a user-initiated JSON download with exactly `type: "vahtikissa-following"`, `version: 1`, `members` and `tags`. It contains no browsing/comparison history or unrelated local-storage values. Import replaces the selections only after validating the schema, version, catalogued IDs and 65,536-byte limit. Malformed, incompatible, unknown-ID or oversized imports leave current selections intact. If the AI catalogue is unavailable, imports containing themes cannot be validated and are rejected without changes. Removed/unknown saved selections remain visible and removable instead of disappearing silently.

Blocked, unavailable, corrupt or full storage never prevents reading public pages. Selection writes report failure and do not confirm a save. Two-key replacements roll back previously written keys on failure where storage permits rollback. Corrupt selections can be replaced explicitly by **Remove all selections** or a valid import. Failed snapshot persistence is disclosed beside the source: the next visit may have no comparison or use an older one. Corrupt snapshot history is safely reseeded without presenting the entire historical dataset as new.

## Verification

`node --test tests/following.test.mjs tests/following-data.test.mjs` checks persistence, legacy selections, validated transfers, storage failures, first/repeat visits, backfills, removals/reappearances, rerenders, source independence and complete source associations.

`npm run test:following` exercises real browser follow/unfollow, navigation, legacy themes, import/export, backfills across reloads, partial failure/recovery, language and reading-mode changes, denied/full/corrupt storage, mobile overflow, and axe accessibility in both reading modes and all colour themes. It uses existing source fixtures with controlled snapshot updates. If bundled Chromium is unavailable, set `BROWSER_CHANNEL=chrome` or another installed supported channel. `npm run check` runs the repository unit checks and source-data validation.
