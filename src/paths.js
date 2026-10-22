// Same authenticated image route and transport restrictions as DSH's document preview.
export function markdownImageUrl(base, sourcePath, destination) {
  let path;
  try { path = decodeURIComponent(destination.split(/[?#]/, 1)[0]); } catch { return; }
  if (!path || !/^https?:/.test(base) && !base.startsWith('dsh-app://app/')) return;
  const absolute = value => /^[A-Za-z]:[/\\]/.test(value) || value.startsWith('/');
  if (!/^[A-Za-z]:[/\\]/.test(path) && /^[A-Za-z][A-Za-z\d+.-]*:/.test(path)) return;
  if (!absolute(path)) {
    if (!sourcePath) return;
    const directory = sourcePath.slice(0, Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\')) + 1);
    path = directory + path;
  }
  if (!absolute(path) || /^[/\\]{2}/.test(path) || /[\u0000-\u001f\u007f]/.test(path)) return;
  return new URL(`api/file?path=${encodeURIComponent(path)}`, base).href;
}
