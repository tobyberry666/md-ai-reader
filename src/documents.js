export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

export async function makeDocument(name, text, sourcePath = '') {
  if (typeof name !== 'string' || !/\.(md|markdown)$/i.test(name) || /[\r\n\0/\\]/.test(name)) throw new Error('请选择 Markdown（.md / .markdown）文件。');
  if (typeof text !== 'string' || text.includes('\0')) throw new Error('文件包含二进制内容，无法作为 Markdown 阅读。');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error('文件过大：第一版最多支持 2 MiB 的 Markdown；不会截断正文。');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name + '\0' + text));
  const id = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { id, name, text, sourcePath };
}

export async function readMarkdownFile(file, sourcePath = '') {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error('文件过大：第一版最多支持 2 MiB 的 Markdown；不会截断正文。');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error('无法读取 UTF-8 文本，请将文件保存为 UTF-8 后重试。'); }
  return makeDocument(file.name, text, sourcePath);
}
