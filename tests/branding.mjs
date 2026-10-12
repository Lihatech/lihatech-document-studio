import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/utils/storage.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node', loader: { '.png': 'dataurl' },
});
const { getStoredData, saveStoredData } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);
globalThis.window = {};
const cache = new Map();
globalThis.localStorage = {
  getItem: key => cache.get(key) ?? null,
  setItem: (key, value) => cache.set(key, value),
};
const initial = getStoredData().settings;
for (const image of ['data:image/png;base64,logo', 'data:image/svg+xml;utf8,<svg>logo</svg>', 'https://example.com/logo.png']) {
  const settings = { ...initial, logoUrl: image, signatureUrl: image, stampUrl: image };
  saveStoredData({ settings });
  const restored = getStoredData().settings;
  for (const field of ['logoUrl', 'signatureUrl', 'stampUrl']) {
    assert.equal(restored[field], image, `${field} must survive refresh`);
  }
}
console.log('Branding images survive saving and reloading.');

globalThis.brandingTestDb = { row: null, error: null };
const shared = await build({
  entryPoints: ['src/lib/supabase.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"https://example.supabase.co"',
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '"test-key"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
  plugins: [{ name: 'mock-shared-storage', setup(build) {
    build.onLoad({ filter: /src[\\/]lib[\\/]firebase\.ts$/ }, () => ({ contents: 'export const auth = null;' }));
    build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'mock', namespace: 'branding' }));
    build.onLoad({ filter: /.*/, namespace: 'branding' }, () => ({ contents: `
      export const createClient = () => ({ from(table) {
        if (table !== 'company_settings') throw new Error('Wrong table');
        return {
          select() { return this; },
          eq(key, value) { if (key !== 'id' || value !== true) throw new Error('Wrong company'); return this; },
          async maybeSingle() { return { data: globalThis.brandingTestDb.row, error: globalThis.brandingTestDb.error }; },
          async upsert(row) {
            if (!globalThis.brandingTestDb.error) globalThis.brandingTestDb.row = row;
            return { error: globalThis.brandingTestDb.error };
          }
        };
      }});
    ` }));
  }}],
});
const { loadCompanySettings, saveCompanySettings } = await import(
  `data:text/javascript;base64,${Buffer.from(shared.outputFiles[0].text).toString('base64')}`
);
assert.equal(await loadCompanySettings(), null);
const settings = { ...initial, logoUrl: 'data:image/png;base64,custom', signatureUrl: 'data:image/png;base64,signature', stampUrl: 'data:image/png;base64,stamp' };
await saveCompanySettings(settings);
cache.clear(); // A different browser has no local settings.
assert.deepEqual(await loadCompanySettings(), settings);
globalThis.brandingTestDb.error = new Error('Storage unavailable');
await assert.rejects(saveCompanySettings(initial), /Storage unavailable/);
await assert.rejects(loadCompanySettings(), /Storage unavailable/);
assert.deepEqual(globalThis.brandingTestDb.row.settings, settings);
console.log('Shared branding loads without a browser cache and propagates save/load failures.');
