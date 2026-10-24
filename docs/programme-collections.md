# Party programme editions

`data/programmes.json` and `#/programmes` are the **2023 parliamentary election collection** from Pohtiva, collection 6. A document can be older than the election. Its publication year, document type, original language and original Pohtiva URL remain attached to the document. The snapshot retrieval date describes the collection check, not document publication. Current parliamentary representation is refreshed separately within this edition; this is not a claim that these are each party's latest programmes.

The importer declares this edition explicitly in `PROGRAMME_COLLECTION` (`parliament-2023`, election year 2023). New snapshots add `collectionId` and `electionYear` metadata; existing snapshots with `collection: "Eduskuntavaalit 2023"` remain supported. Programme IDs and existing theme links retain their original meaning.

When another election collection is added:

1. Preserve the published 2023 collection at its existing file and route. Do not repoint its source URL or replace its documents with a newer election.
2. Give the new edition its own source, collection ID, election year and data file, for example `programmes-2027.json`. Determine that source from the actual published collection. Do not infer a source URL or treat a document's publication year as its election edition.
3. Add an edition selector and a shareable edition parameter. Keep old links resolving to the 2023 archive. Label each edition in all three UI languages and retain each document's metadata and source notices.
4. Associate thematic analysis with the original document ID and edition. Shared themes are discovery links, not evidence that a promise was fulfilled.

There is currently one edition. No speculative source ingestion or empty future edition is created.
