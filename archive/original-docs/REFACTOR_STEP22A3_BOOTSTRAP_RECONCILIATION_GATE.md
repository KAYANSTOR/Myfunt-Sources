# Step 22A.3 — Bootstrap Reconciliation Gate

Version: 2.13.5

## Goal
Prevent Initial Company Bootstrap from blindly overwriting an adopted local snapshot with server rows. Every incoming row is classified before the batch is allowed to write.

## Classifications
- `same`: semantic business fields match. Server/bootstrap metadata may still be refreshed.
- `server-newer`: the server version is newer and there is no unresolved local command/tombstone. Safe to ingest.
- `local-newer`: the device has a newer or pending local state. Bootstrap is paused; no row from that batch is written.
- `conflict`: both sides advanced, server deleted while local work is pending, or equal versions contain different semantic content. Bootstrap is paused; no row from that batch is written.
- `deleted`: the server explicitly reports deletion, or after a full `replaceLocal` bootstrap an adopted local row was not present in the complete server dataset.

## Atomic batch gate
`MyfntLocal.ingestReconciledBootstrapBatch()` opens one IndexedDB transaction covering:
- target entity store
- `sync_queue`
- `entity_tombstones`

It first reads/classifies the entire batch. If one `local-newer` or `conflict` exists, the batch performs zero entity writes. This prevents partial merges.

## replaceLocal behavior changed
The old sequence was:
1. Adoption guard
2. Clear local company data
3. Download bootstrap

The new sequence is:
1. Adoption guard + completed First Server Adoption
2. Keep local snapshot intact
3. Reconcile every downloaded server batch
4. Stop on any unresolved local/server difference
5. Only after the full config + working + archive bootstrap succeeds, prune unseen rows from the server-managed bootstrap tables

Therefore a network failure, conflict, or mapping mismatch before completion leaves the adopted local snapshot available.

## Deferred prune
Incoming server rows are stamped with `bootstrap_id_seen` / `bootstrap_revision_seen`.
At successful full completion, `finalizeBootstrapReplacement()` removes server-managed local rows not seen in the current bootstrap. These removals are counted as the final `deleted` set (`finalPruned`).

Before pruning, the Local Data Adoption Guard is executed again. Any new pending/sending/failed/conflict command or unresolved remote tombstone blocks the prune.

## Semantic comparison
Known domain tables compare only their canonical business/API fields. Runtime metadata, search indexes, local timestamps, adoption markers, bootstrap markers, fingerprints and server bookkeeping are excluded. This avoids false conflicts caused only by local implementation metadata.

## Events / state
A blocked reconciliation sets bootstrap state to:
- `phase: reconciliation-required`
- `pausedReason: reconciliation`

and dispatches `myfnt:bootstrap-reconciliation-required`.

The persisted reconciliation counters are:
- `same`
- `server-newer`
- `local-newer`
- `conflict`
- `deleted`
- `finalPruned`

## Safety invariant
No `replaceLocal` operation may destroy the pre-existing adopted device snapshot before all server batches have passed reconciliation and the final adoption/sync guard is still clean.
