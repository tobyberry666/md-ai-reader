import { mkdir, readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeDocument } from './documents.js';

function checkId(id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new Error('无效的文档标识。');
}

function metadata({ text, ...document }) { return document; }

export async function createLibrary(directory) {
  await mkdir(directory, { recursive: true });
  const records = new Map();
  const sessions = new Map();
  const writes = new Map();
  const pendingBinds = new Map();
  for (const file of await readdir(directory)) {
    if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
    const value = JSON.parse(await readFile(join(directory, file), 'utf8'));
    const checked = await makeDocument(value.name, value.text, value.sourcePath);
    if (checked.id !== value.id || file !== value.id + '.json' || typeof value.sessionId !== 'string') throw new Error(`文档缓存损坏：${file}`);
    records.set(value.id, value);
    sessions.set(value.sessionId, value.id);
  }
  async function update(id, change) {
    const previous = writes.get(id) ?? Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      const value = change(records.get(id));
      const temporary = join(directory, id + '.' + randomUUID() + '.tmp');
      await writeFile(temporary, JSON.stringify(value), 'utf8');
      await rename(temporary, join(directory, id + '.json'));
      records.set(id, value);
      return value;
    });
    writes.set(id, pending);
    try { return await pending; } finally { if (writes.get(id) === pending) writes.delete(id); }
  }
  return {
    list: () => [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(metadata),
    open({ id }) {
      checkId(id);
      const document = records.get(id);
      if (!document) throw new Error('文档不存在，请重新导入。');
      return { ...document };
    },
    forSession: sessionId => {
      const document = records.get(sessions.get(sessionId));
      return document ? { ...document } : undefined;
    },
    async bind(value) {
      checkId(value.id);
      const checked = await makeDocument(value.name, value.text, value.sourcePath);
      if (checked.id !== value.id) throw new Error('文档标识与正文不一致。');
      if (typeof value.sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(value.sessionId)) throw new Error('无效的会话标识。');
      const existing = records.get(value.id);
      if (existing) {
        await pendingBinds.get(value.id);
        if (checked.sourcePath && checked.sourcePath !== records.get(value.id).sourcePath) {
          const relocated = await update(value.id, current => ({ ...current, sourcePath: checked.sourcePath }));
          return metadata(relocated);
        }
        return metadata(records.get(value.id));
      }
      if (sessions.has(value.sessionId)) throw new Error('该会话已绑定另一篇文档。');
      const document = { ...checked, sessionId: value.sessionId, scrollTop: 0, updatedAt: Date.now() };
      // Reserve identities before I/O so concurrent imports cannot alias sessions.
      records.set(document.id, document);
      sessions.set(document.sessionId, document.id);
      const pending = update(document.id, () => document);
      pendingBinds.set(document.id, pending);
      try { await pending; }
      catch (error) { records.delete(document.id); sessions.delete(document.sessionId); throw error; }
      finally { pendingBinds.delete(document.id); }
      return metadata(document);
    },
    async position({ id, scrollTop }) {
      checkId(id);
      if (!Number.isFinite(scrollTop) || scrollTop < 0) throw new Error('无效的阅读位置。');
      const previous = records.get(id);
      if (!previous) throw new Error('文档不存在。');
      await update(id, current => ({ ...current, scrollTop }));
      return true;
    },
  };
}
