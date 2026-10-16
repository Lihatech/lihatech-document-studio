import { batchEndInstant, type Row } from './lms';

export function batchState(batch: Row): string {
  if (['paused', 'cancelled', 'completed'].includes(batch.status)) return batch.status;
  if (batch.end_date && Date.now() >= batchEndInstant(batch.end_date)!.getTime()) return 'completed';
  if (batch.start_date && Date.now() < Date.parse(`${batch.start_date}T00:00:00+05:30`)) return 'planned';
  return batch.status === 'planned' ? 'active' : batch.status;
}

export const assignableBatch = (batch: Row) => !!batch.start_date && !!batch.end_date && ['active', 'planned'].includes(batchState(batch));

export function currentEnrollment(enrollments: Row[]): Row | undefined {
  return [...enrollments].sort((a, b) => {
    const rank = (row: Row) => row.accessible ? 3 : !row.left_at && ['active', 'suspended'].includes(row.status) ? 2 : 1;
    return rank(b) - rank(a) || String(b.batch_start_date || b.starts_at).localeCompare(String(a.batch_start_date || a.starts_at));
  })[0];
}
