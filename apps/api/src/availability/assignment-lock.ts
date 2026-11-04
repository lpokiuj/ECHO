import type { EntityManager } from 'typeorm';

// Assigning a user and marking them unavailable are mutually exclusive for the
// same (service, user). Each statement already carries a NOT EXISTS guard, but
// under READ COMMITTED two concurrent statements can both pass it. Both paths
// therefore take this transaction-scoped advisory lock first; the second
// statement then runs after the first commits and sees its row.
// Keys are locked in sorted order so two batches cannot deadlock.
export async function lockAssignmentSlots(
  manager: EntityManager,
  serviceId: string,
  userIds: string[],
): Promise<void> {
  const keys = userIds.map((id) => `${serviceId}:${id}`);
  await manager.query(
    `SELECT pg_advisory_xact_lock(hashtextextended(k, 0))
     FROM (SELECT k FROM unnest($1::text[]) AS k ORDER BY k) AS ordered`,
    [keys],
  );
}
