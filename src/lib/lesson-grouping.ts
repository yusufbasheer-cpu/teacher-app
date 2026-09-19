/**
 * Chronological grouping for the lesson library.
 *
 * A term's worth of lessons is one undifferentiated stream of rows, where the
 * only cue to when something was made is a date column the eye has to read one
 * row at a time. Teachers look for "the one I made this week" far more often
 * than for a specific date, so the list is banded by recency instead.
 *
 * Kept as a pure function over an injected `now` so the boundaries are testable
 * without freezing the clock.
 */

export type RecencyBucketId = "this-week" | "this-month" | "older";

export type RecencyGroup<T> = {
  id: RecencyBucketId;
  label: string;
  items: T[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const BUCKETS: { id: RecencyBucketId; label: string; maxAgeDays: number }[] = [
  { id: "this-week", label: "This week", maxAgeDays: 7 },
  { id: "this-month", label: "Earlier this month", maxAgeDays: 30 },
  { id: "older", label: "Older", maxAgeDays: Number.POSITIVE_INFINITY },
];

function bucketFor(createdAt: string, now: number): RecencyBucketId {
  const created = new Date(createdAt).getTime();
  // An unparseable or future timestamp must still land somewhere rather than
  // dropping the lesson out of the list entirely.
  if (!Number.isFinite(created)) return "older";

  const ageDays = (now - created) / DAY_MS;
  if (ageDays < 0) return "this-week";

  return BUCKETS.find((b) => ageDays < b.maxAgeDays)?.id ?? "older";
}

/**
 * Bands items into recency groups, preserving the order they arrive in and
 * dropping any band that would render empty. Every input item appears in
 * exactly one group.
 */
export function groupByRecency<T extends { created_at: string }>(
  items: T[],
  now: number = Date.now(),
): RecencyGroup<T>[] {
  const byBucket = new Map<RecencyBucketId, T[]>();

  for (const item of items) {
    const id = bucketFor(item.created_at, now);
    const existing = byBucket.get(id);
    if (existing) existing.push(item);
    else byBucket.set(id, [item]);
  }

  return BUCKETS.filter((bucket) => byBucket.get(bucket.id)?.length).map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    items: byBucket.get(bucket.id)!,
  }));
}
