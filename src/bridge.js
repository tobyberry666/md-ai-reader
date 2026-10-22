export async function remoteValue(promise) {
  const result = await promise;
  if (!result.ok) throw new Error(result.error?.message || 'DSH 请求失败。');
  return result.value;
}

export async function retainDocumentSession(ctx, document) {
  const reference = ctx.sessions.retain(document.sessionId, { source: 'mdReader' });
  try { await reference.ready; return reference; }
  catch (error) { reference.release(); throw error; }
}

export function nativeInput(ctx, sessionId) {
  const scope = ctx.sessions.scope(sessionId);
  if (!scope) throw new Error('文档会话未就绪。');
  return ctx.conversation.input.for(scope);
}

export function registerQuoteSource(ctx, getDocument) {
  return ctx.inputTriggers.registerSource({
    name: 'md-reader-quote', trigger: '§',
    candidates: async () => [],
    codec: {
      clipboardText: ref => JSON.parse(ref).text,
      serialize: async ref => {
        const value = JSON.parse(ref);
        const document = await getDocument(value.documentId);
        if (!document) throw new Error('引用的文档未打开，请重新选择原文。');
        return `\n【引用自 ${document.name}】\n${value.text}\n【引用结束】\n`;
      },
    },
  });
}

export function insertQuote(ctx, document, text) {
  const input = nativeInput(ctx, document.sessionId);
  const inserted = input.insertReference({
    source: 'md-reader-quote', ref: JSON.stringify({ documentId: document.id, text }),
    label: quoteLabel(text), clipboardText: text,
  }, input.actions.captureInsertion());
  if (!inserted) throw new Error('输入框正在提交，请稍后再引用。');
  input.focus();
}
import { quoteLabel } from './context.js';

