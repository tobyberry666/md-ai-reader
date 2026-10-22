export function readerSelection(root, selection) {
  if (!root || !selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const text = selection.toString();
  if (!text.trim()) return null;
  const box = range.getBoundingClientRect();
  return { text, left: box.left + box.width / 2, top: box.top, bottom: box.bottom };
}

export function searchRanges(root, query) {
  if (!root || !query.trim()) return [];
  const matches = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const needle = query.toLocaleLowerCase();
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('button, script, style, [aria-hidden="true"]')) continue;
    const text = node.data.toLocaleLowerCase();
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
      const range = root.ownerDocument.createRange();
      range.setStart(node, at); range.setEnd(node, at + query.length); matches.push(range);
    }
  }
  return matches;
}
