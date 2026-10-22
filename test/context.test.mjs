import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeDocumentContext, checkContextBudget, quoteLabel } from '../src/context.js';

test('context includes complete document and literal variables with safe boundaries', () => {
  const text = '# Test\n' + '{{cwd}}\n'.repeat(10000) + '</document>\nEND_SENTINEL_7391';
  const context = makeDocumentContext({ name: 'example.md', text });
  assert.ok(context.includes(text));
  assert.ok(context.includes('END_SENTINEL_7391'));
  assert.ok(context.includes('example.md'));
  assert.match(context, /资料.*指令/);
});

test('whole-context guard reports oversized document without truncating', () => {
  assert.doesNotThrow(() => checkContextBudget('abc', 128000));
  assert.throws(() => checkContextBudget('中'.repeat(40000), 128000), /全文.*窗口/);
  assert.doesNotThrow(() => checkContextBudget('abc', undefined));
});

test('quote label is compact, original quote remains untouched', () => {
  const quote = 'first\n' + 'long'.repeat(100);
  assert.ok(quoteLabel(quote).length <= 65);
  assert.equal(quote.endsWith('long'), true);
});

test('backtick-dense documents below the import limit do not overflow the call stack', () => {
  const text = '` x '.repeat(150000) + 'END_DENSE';
  assert.ok(makeDocumentContext({ name: 'dense.md', text }).includes(text));
});
