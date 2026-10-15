import assert from 'node:assert/strict';
import { materialPreviewUrl } from '../src/lib/materialPreview.ts';

assert.equal(materialPreviewUrl('https://drive.google.com/file/d/abc-123/view?usp=sharing'), 'https://drive.google.com/file/d/abc-123/preview');
assert.equal(materialPreviewUrl('https://drive.google.com/open?id=abc-123'), 'https://drive.google.com/file/d/abc-123/preview');
assert.equal(materialPreviewUrl('https://docs.google.com/document/d/doc_123/edit'), 'https://docs.google.com/document/d/doc_123/preview');
assert.equal(materialPreviewUrl('https://example.com/course'), 'https://example.com/course');
console.log('Material preview URLs passed.');
