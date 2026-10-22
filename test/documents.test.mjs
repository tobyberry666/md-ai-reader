import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeDocument, readMarkdownFile, MAX_DOCUMENT_BYTES } from '../src/documents.js';

test('document identity includes name and all content, stable across reimports', async () => {
  const a = await makeDocument('报告.md', '# Title\n{{literal}}');
  assert.match(a.id, /^[a-f0-9]{64}$/);
  assert.equal(a.id, (await makeDocument('报告.md', a.text)).id);
  assert.notEqual(a.id, (await makeDocument('报告.md', a.text + 'end')).id);
  assert.notEqual(a.id, (await makeDocument('other.md', a.text)).id);
  assert.equal(a.text, '# Title\n{{literal}}');
});

test('imports UTF-8 MD bytes exactly and rejects incompatible files', async () => {
  const f = new File(['# 你好\n末尾'], 'Doc.MARKDOWN');
  assert.equal((await readMarkdownFile(f)).text, '# 你好\n末尾');
  await assert.rejects(readMarkdownFile(new File(['hello'], 'a.exe')), /Markdown/);
  await assert.rejects(readMarkdownFile(new File([new Uint8Array([0xff])], 'a.md')), /UTF-8/);
  await assert.rejects(readMarkdownFile(new File(['a\0b'], 'a.md')), /二进制/);
  await assert.rejects(readMarkdownFile(new File(['x'.repeat(MAX_DOCUMENT_BYTES + 1)], 'big.md')), /过大/);
});
