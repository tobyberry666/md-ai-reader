import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeDocument } from '../src/documents.js';
import { createLibrary } from '../src/library.js';

const temporaryRoot = new URL('../.cache/tests/', import.meta.url);
await mkdir(temporaryRoot, { recursive: true });

test('library persists full text, scroll and independent session associations', async t => {
  const directory = await mkdtemp(new URL('library-', temporaryRoot));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const lib = await createLibrary(directory);
  const a = { ...await makeDocument('a.md', '# A\nEND_A'), sessionId: 'session-a' };
  const b = { ...await makeDocument('b.md', '# B\nEND_B'), sessionId: 'session-b' };
  await lib.bind(a);
  await lib.bind(b);
  await lib.position({ id: a.id, scrollTop: 361 });
  const reopened = await createLibrary(directory);
  assert.equal(reopened.forSession('session-a').text, a.text);
  assert.equal(reopened.forSession('session-b').text, b.text);
  assert.equal(reopened.open({ id: a.id }).scrollTop, 361);
  assert.equal(reopened.list()[0].text, undefined, 'catalog must not transfer all documents');
  assert.equal((await reopened.bind({ ...a, sessionId: 'unrelated-session' })).sessionId, 'session-a');
  assert.equal(JSON.parse(await readFile(join(directory, a.id + '.json'), 'utf8')).text, a.text);
  const relinked = await reopened.bind({ ...a, sourcePath: 'D:/Notes/a.md' });
  assert.equal(relinked.sessionId, 'session-a');
  assert.equal(relinked.sourcePath, 'D:/Notes/a.md');
  assert.equal(reopened.open({ id: a.id }).sourcePath, 'D:/Notes/a.md');
});

test('rejects forged document IDs, invalid paths and session reuse across documents', async t => {
  const directory = await mkdtemp(new URL('library-', temporaryRoot));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const lib = await createLibrary(directory);
  const a = { ...await makeDocument('a.md', 'a'), sessionId: 'same-session' };
  await lib.bind(a);
  await assert.rejects(lib.bind({ ...a, text: 'different' }), /标识/);
  assert.throws(() => lib.open({ id: '../credentials' }), /标识/);
  await assert.rejects(lib.bind({ ...await makeDocument('b.md', 'b'), sessionId: a.sessionId }), /会话/);
});

test('concurrent source relocation and scroll saves preserve both fields on disk', async t => {
  const directory = await mkdtemp(new URL('library-', temporaryRoot));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const lib = await createLibrary(directory);
  const doc = { ...await makeDocument('a.md', '# A'), sessionId: 'session-a' };
  await lib.bind(doc);
  await Promise.all([
    lib.bind({ ...doc, sourcePath: 'D:/Notes/a.md' }),
    lib.position({ id: doc.id, scrollTop: 999 }),
  ]);
  const reopened = await createLibrary(directory);
  assert.equal(reopened.open({ id: doc.id }).sourcePath, 'D:/Notes/a.md');
  assert.equal(reopened.open({ id: doc.id }).scrollTop, 999);
});
