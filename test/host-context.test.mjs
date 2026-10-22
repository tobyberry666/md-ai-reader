import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDocumentContext } from '../src/host-context.js';

test('registers complete literal user context for only the matching session, without model calls', async () => {
  const text = '{{not_a_variable}}\n' + 'x'.repeat(8000) + 'END_5cf1';
  let provider, onRequest;
  const ctx = {
    systemPrompt: { context(value) { provider = value; } },
    on(name, listener) { assert.equal(name, 'agent/request'); onRequest = listener; },
    llm: { resolveModelInfo: async () => ({ context: { contextWindow: 128000 } }) },
  };
  installDocumentContext(ctx, { forSession: id => id === 'reader-session' ? { name: 'a.md', text } : undefined });
  assert.equal(provider.required, true);
  assert.equal(provider.interpolate, false);
  assert.ok(provider.text({ agent: { id: 'reader-session' } }).includes(text));
  assert.equal(provider.text({ agent: { id: 'original-session' } }), '');
  const config = { provider: 'existing-provider', model: 'existing-model' };
  assert.equal(await onRequest({ agent: { id: 'reader-session' } }, async () => config), config);
});

test('rejects oversized whole document before model request while preserving native configuration', async () => {
  let onRequest;
  const ctx = {
    systemPrompt: { context() {} }, on(_name, listener) { onRequest = listener; },
    llm: { resolveModelInfo: async () => ({ context: { contextWindow: 48000 } }) },
  };
  installDocumentContext(ctx, { forSession: () => ({ name: 'large.md', text: '中'.repeat(10000) }) });
  await assert.rejects(onRequest({ agent: { id: 'reader' } }, async () => ({ provider: 'p', model: 'm' })), /全文.*窗口/);
});
