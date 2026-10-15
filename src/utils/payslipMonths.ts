export interface PayslipMonth {
  monthAndYear: string;
  daysInMonth: number;
  paymentDate: string;
}

export function getPayslipMonths(from: string, to: string, paymentDay: number): PayslipMonth[] {
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!validMonth.test(from) || !validMonth.test(to) || !Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) return [];
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  if (fromYear < 1900 || toYear < 1900) return [];
  const count = (toYear - fromYear) * 12 + toMonth - fromMonth + 1;
  if (count < 1 || count > 60) return [];
  return Array.from({ length: count }, (_, index) => {
    const first = new Date(Date.UTC(fromYear, fromMonth - 1 + index, 1));
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth() + 1;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      monthAndYear: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first),
      daysInMonth,
      paymentDate: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(paymentDay, daysInMonth)).padStart(2, '0')}`,
    };
  });
}
