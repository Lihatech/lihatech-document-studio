// Keep the established whole-rupee input format, without inventing compensation for blank inputs.
export function parseAnnualCompensation(value: string): number {
  const amount = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}
