import assert from 'node:assert/strict';
import { getPayslipMonths } from '../src/utils/payslipMonths';

const months = getPayslipMonths('2023-12', '2024-03', 31);
assert.deepEqual(months.map(month => month.monthAndYear), ['December 2023', 'January 2024', 'February 2024', 'March 2024']);
assert.deepEqual(months.map(month => month.paymentDate), ['2023-12-31', '2024-01-31', '2024-02-29', '2024-03-31']);
assert.equal(months[2].daysInMonth, 29);
assert.deepEqual(getPayslipMonths('2024-03', '2024-02', 15), []);
assert.deepEqual(getPayslipMonths('2024-01', '2029-01', 15), []);
console.log('Payslip month range checks passed.');
