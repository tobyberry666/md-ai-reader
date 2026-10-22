import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retainDocumentSession, insertQuote, registerQuoteSource } from '../src/bridge.js';

test('rejects a retained DSH session whose ready promise resolves to an error state', async () => {
  let released = 0;
  const ctx = { sessions: { list: { getSnapshot: () => ({ byId: { a: {} } }) }, retain: () => ({ ready: Promise.resolve(), release: () => released++, binding: { session: { getSnapshot: () => ({ openState: 'error', openError: { message: 'offline' } }) } } }) } };
  await assert.rejects(retainDocumentSession(ctx, { sessionId: 'a' }), /offline/);
  assert.equal(released, 1);
});

test('refreshes native catalog before restoring a persisted document session', async () => {
  let catalog = {}, refreshed = false;
  const reference = { ready: Promise.resolve(), release() {}, binding: { session: { getSnapshot: () => ({ openState: 'open' }) } } };
  const ctx = { sessions: {
    list: { getSnapshot: () => ({ byId: catalog }) },
    refresh: async () => { refreshed = true; catalog = { persisted: {} }; },
    retain: id => { assert.ok(catalog[id], 'must refresh catalog before retain'); return reference; },
  } };
  assert.equal(await retainDocumentSession(ctx, { sessionId: 'persisted' }), reference);
  assert.equal(refreshed, true);
});

test('inserted reference captures native insertion span and serializes original quote verbatim', async () => {
  let inserted, source, focused = false;
  const span = { start: 5, end: 5, draftRev: 3 };
  const input = { actions: { captureInsertion: () => span }, insertReference: (value, location) => { inserted = { value, location }; return true; }, focus: () => { focused = true; } };
  const ctx = { sessions: { scope: () => ({}) }, conversation: { input: { for: () => input } }, inputTriggers: { registerSource: value => { source = value; } } };
  const doc = { id: 'doc', name: 'test.md', sessionId: 'session' };
  const text = 'exact quote\n第二行';
  registerQuoteSource(ctx, async () => doc);
  insertQuote(ctx, doc, text);
  assert.equal(inserted.location, span);
  assert.equal(focused, true);
  assert.ok((await source.codec.serialize(inserted.value.ref)).includes(text));
});
