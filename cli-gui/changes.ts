import type { CliChange, CliDirectoryEntry } from './types';
import type { DirectoryBatch, DirectoryRemoval } from '../chat/directory/protocol';

function merge(left: DirectoryBatch<CliDirectoryEntry>, right: DirectoryBatch<CliDirectoryEntry>) {
  const upserts = new Map<string, CliDirectoryEntry>();
  const removals = new Map<string, DirectoryRemoval>();
  for (const batch of [left, right]) {
    for (const entry of batch.removals) { upserts.delete(entry.key); removals.set(entry.key, entry); }
    for (const entry of batch.upserts) { removals.delete(entry.key); upserts.set(entry.key, entry); }
  }
  return { ...right, from: left.from, upserts: [...upserts.values()], removals: [...removals.values()] };
}

/** Coalesce each stream independently and retain coverage even when intermediate rows disappear. */
export function coalesceCliChanges(changes: CliChange[]) {
  const pending = new Map<string, CliChange>();
  for (const change of changes) {
    const key = change.batch ? change.batch.checkpoint.stream : JSON.stringify([change.engine, change.id]);
    const previous = pending.get(key);
    pending.set(key, previous?.batch && change.batch ? { ...change, batch: merge(previous.batch, change.batch) }
      : { ...previous, ...change });
  }
  return [...pending.values()];
}
