import assert from 'node:assert/strict';
import { build } from 'esbuild';

globalThis.studioTestRows = [];
globalThis.studioTestFailure = null;
const result = await build({
  entryPoints: ['src/lib/documentStudio.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'mock-studio-database', setup(build) {
    build.onLoad({ filter: /src[\\/]lib[\\/]firebase\.ts$/ }, () => ({ contents: 'export const auth = null;' }));
    build.onLoad({ filter: /src[\\/]lib[\\/]supabase\.ts$/ }, () => ({ contents: `
      export const loadCompanySettings = async () => ({});
      export const supabase = {
        from() { return { select() { return this; }, order() { return this; }, async range(start,end) { return { data: globalThis.studioTestRows.slice(start,end+1), error: null }; } }; },
        async rpc(name,{p_changes}) {
          if (name !== 'save_document_studio_records') throw new Error('Wrong endpoint');
          if (globalThis.studioTestFailure) return { error: globalThis.studioTestFailure };
          const rows = structuredClone(globalThis.studioTestRows), revisions = [];
          for (const change of p_changes) {
            const index = rows.findIndex(row => row.kind === change.kind && row.record_id === change.record_id);
            const old = rows[index];
            if ((old?.version ?? 0) !== change.expected_version) return { error: { code: '40001' } };
            const row = { kind: change.kind, record_id: change.record_id, data: change.data, archived: change.archived, version: change.expected_version + 1 };
            if (index < 0) rows.push(row); else rows[index] = row;
            revisions.push(row);
          }
          globalThis.studioTestRows = rows;
          return { data: revisions, error: null };
        }
      };
    ` }));
  }}],
});
const { buildStudioChanges, loadStudioData, saveStudioChanges, isSharedRecord, getReservedInvoiceNumbers } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const empty = { settings: {}, invoices: [], certificates: [], letters: [], payslips: [], clients: [], courses: [], employees: [], activities: [] };
const invoice = { id: 'real-invoice', invoiceNumber: 'LT-INV-2026-001', clientName: 'Real client', totalAmount: 0 };
assert.deepEqual(buildStudioChanges(empty, {}), []);
assert.equal(buildStudioChanges(empty, { invoices: [invoice] })[0].expected_version, 0);
await saveStudioChanges(empty, { invoices: [invoice] });
let loaded = await loadStudioData(empty);
assert.deepEqual(loaded.invoices, [invoice]);
assert.deepEqual(buildStudioChanges(loaded, { invoices: loaded.invoices }), []);
// An unrelated record saved from another browser must survive this browser's edit.
globalThis.studioTestRows.push({ kind: 'invoice', record_id: 'other-browser', data: { id: 'other-browser' }, version: 1, archived: false });
await saveStudioChanges(loaded, { invoices: [{ ...invoice, clientName: 'Edited client' }] });
assert.equal(globalThis.studioTestRows.length, 2);
const freshBrowser = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text + '\n// Separate browser session').toString('base64')}`);
await assert.rejects(freshBrowser.saveStudioChanges(empty, { invoices: [invoice] }), /changed on another device/);
loaded = await loadStudioData(empty);
globalThis.studioTestRows[0].version += 1;
await assert.rejects(saveStudioChanges(loaded, { invoices: [] }), /changed on another device/);
assert.equal(globalThis.studioTestRows.every(row => !row.archived), true);
loaded = await loadStudioData(empty);
await saveStudioChanges(loaded, { invoices: loaded.invoices.filter(row => row.id !== invoice.id) });
assert.equal(isSharedRecord('invoices', invoice.id), true, 'archived browser records must not be re-imported');
loaded = await loadStudioData(empty);
assert.equal(loaded.invoices.some(row => row.id === invoice.id), false);
assert.ok(getReservedInvoiceNumbers().includes(invoice.invoiceNumber), 'Archived invoice numbers remain reserved for new invoices');
assert.equal(globalThis.studioTestRows[0].data.clientName, 'Edited client', 'archiving retains the document payload');
globalThis.studioTestFailure = new Error('Offline');
await assert.rejects(saveStudioChanges(loaded, { clients: [{ id: 'client-new', name: 'New client' }] }), /Offline/);
assert.equal(globalThis.studioTestRows.some(row => row.kind === 'client'), false);
assert.throws(() => buildStudioChanges(empty, { invoices: [invoice, invoice] }), /Duplicate record IDs/);
globalThis.studioTestRows = Array.from({ length: 501 }, (_, index) => ({ kind: 'certificate', record_id: String(index), version: 1, archived: false, data: { id: String(index), candidateName: 'Existing candidate' } }));
assert.equal((await loadStudioData(empty)).certificates.length, 501, 'registry loads every page');
const utils = await build({ entryPoints: ['src/utils/certificateUtils.ts', 'src/utils/compensation.ts'], bundle: true, write: false, format: 'esm', platform: 'node', outdir: 'unused' });
const modules = await Promise.all(utils.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)));
const categories = modules.find(module => module.getCertificateCategoryOptions).getCertificateCategoryOptions(['Custom Category', 'custom category'], 'Historical Category');
assert.equal(categories.filter(option => option.value.toLowerCase() === 'custom category').length, 1);
assert.ok(categories.some(option => option.value === 'Historical Category'));
const parse = modules.find(module => module.parseAnnualCompensation).parseAnnualCompensation;
assert.equal(parse(''), 0); assert.equal(parse('₹4,50,000 / annum'), 450000);
console.log('Registry persistence, archives, multi-device conflicts, paging, categories, and blank compensation checks pass.');
