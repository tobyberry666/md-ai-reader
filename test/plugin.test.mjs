import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

test('client registers a separate page and session-scoped native chat, then cleans up', async () => {
  const registrations = [];
  const cleanups = [];
  let plugin;
  const React = { createElement: (...args) => args };
  const ctx = {
    inject(keys, callback) { assert.deepEqual(Array.from(keys), ['remote.mdReader']); callback(this); },
    slots: {
      inject(_key, callback) {
        const result = callback();
        if (typeof result?.[Symbol.iterator] === 'function') cleanups.push(...result);
        else if (result) cleanups.push(result);
      },
      register(options, component) { registrations.push({ options, component }); return () => { registrations.pop(); }; },
    },
    effect(callback) { const result = callback(); if (result) cleanups.push(result); },
    remote: { $mount: async () => () => {} },
    inputTriggers: { registerSource: () => () => {} },
    on() {},
  };
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(entry) { plugin = entry.factory(name => name === 'react' ? React : { MarkdownText: () => null }); } } },
    document: { createElement: () => ({ dataset: {}, remove() {} }), head: { append() {} } },
    console, TextEncoder, TextDecoder, crypto, URL, setTimeout, clearTimeout,
  });
  assert.ok(plugin?.apply);
  await plugin.apply(ctx);
  assert.ok(registrations.some(({ options }) => options.name === 'main' && options.key === 'md-reader'));
  const chat = registrations.find(({ options }) => options.name === 'md-reader.conversation');
  assert.ok(chat, 'must expose a session-bound native conversation wrapper');
  assert.ok(registrations.some(({ options }) => options.name === 'sidebar.panellist' && options.id === 'md-reader'));
  for (const cleanup of cleanups.reverse()) await cleanup();
  assert.equal(registrations.length, 0);
});
