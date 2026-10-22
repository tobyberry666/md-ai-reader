import { readerSelection, searchRanges } from './selection.js';
import { markdownImageUrl } from './paths.js';

const markdownLabels = {
  code: { copyLabel: '复制', copiedLabel: '已复制', toolbarLabels: { codeLabel: '代码', wrapLabel: '换行', unwrapLabel: '不换行' } },
  footnotes: '脚注',
};

export function Reader({ document: doc, onQuote, onPosition }) {
  const body = React.useRef(null);
  const scroller = React.useRef(null);
  const toolbar = React.useRef(null);
  const searchInput = React.useRef(null);
  const [toc, setToc] = React.useState([]);
  const [showToc, setShowToc] = React.useState(true);
  const [selection, setSelection] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [matchIndex, setMatchIndex] = React.useState(0);
  const [matches, setMatches] = React.useState([]);
  const [fontSize, setFontSize] = React.useState(16);
  const position = React.useRef(doc.scrollTop || 0);
  const saveTimer = React.useRef(null);
  const save = React.useRef(onPosition);
  save.current = onPosition;
  const pathImages = React.useMemo(() => ({ resolve: destination => markdownImageUrl(window.document.baseURI, doc.sourcePath, destination) }), [doc.sourcePath]);

  React.useEffect(() => {
    const refresh = () => {
      const headings = [...body.current.querySelectorAll('h1,h2,h3,h4,h5,h6')];
      setToc(headings.map((element, index) => ({ element, index, level: +element.tagName.slice(1), text: element.textContent })));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(body.current, { childList: true, subtree: true });
    const timer = setTimeout(() => { scroller.current.scrollTop = position.current; }, 0);
    return () => { observer.disconnect(); clearTimeout(timer); clearTimeout(saveTimer.current); save.current(position.current); };
  }, []);

  React.useEffect(() => {
    const changed = () => {
      // Interacting with the quote button must keep its captured Range alive.
      if (toolbar.current?.contains(window.document.activeElement)) return;
      setSelection(readerSelection(body.current, window.getSelection()));
    };
    window.document.addEventListener('selectionchange', changed);
    return () => window.document.removeEventListener('selectionchange', changed);
  }, []);

  React.useEffect(() => {
    const ranges = searchRanges(body.current, query);
    setMatches(ranges); setMatchIndex(0);
    if (globalThis.CSS?.highlights && globalThis.Highlight) CSS.highlights.set('md-reader-search', new Highlight(...ranges));
    return () => globalThis.CSS?.highlights?.delete('md-reader-search');
  }, [query, doc.id]);

  React.useEffect(() => {
    const range = matches[matchIndex];
    range?.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'instant' });
    if (globalThis.CSS?.highlights && globalThis.Highlight) {
      CSS.highlights.set('md-reader-current', new Highlight(...(range ? [range] : [])));
    }
    return () => globalThis.CSS?.highlights?.delete('md-reader-current');
  }, [matches, matchIndex]);

  React.useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);
  const move = delta => { if (matches.length) setMatchIndex(i => (i + delta + matches.length) % matches.length); };
  const ask = event => {
    event.preventDefault();
    if (selection) { onQuote(selection.text); setSelection(null); }
  };
  const controls = h('div', { className: 'mdr-reading-tools' },
    h('div', { className: 'mdr-tool-group' },
      h('button', { onClick: () => setShowToc(v => !v), 'aria-label': '切换目录', 'aria-pressed': showToc, title: '目录' }, icon('toc')),
      h('span', { className: 'mdr-muted mdr-word-count' }, `${doc.text.length.toLocaleString()} 字符`)),
    h('div', { className: 'mdr-tool-group' },
      h('button', { onClick: () => setFontSize(v => Math.max(13, v - 1)), 'aria-label': '缩小字号' }, 'A−'),
      h('button', { onClick: () => setFontSize(v => Math.min(24, v + 1)), 'aria-label': '放大字号' }, 'A+'),
      h('span', { className: 'mdr-tool-divider' }),
      h('button', { onClick: () => setSearchOpen(v => !v), 'aria-label': '搜索文档', title: '搜索 Ctrl+F' }, icon('search'))));

  return h('section', {
    className: 'mdr-reader', 'aria-label': 'Markdown 阅读区', tabIndex: -1,
    onKeyDown: event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopPropagation(); setSearchOpen(true); }
      if (event.key === 'Escape') { setSearchOpen(false); setQuery(''); setSelection(null); }
    },
  }, controls,
  searchOpen && h('div', { className: 'mdr-search', role: 'search' },
    icon('search'), h('input', { ref: searchInput, value: query, placeholder: '在文档中查找…', 'aria-label': '查找文本', onChange: event => setQuery(event.target.value), onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); move(event.shiftKey ? -1 : 1); } } }),
    h('span', { role: 'status' }, `${matches.length ? matchIndex + 1 : 0} / ${matches.length}`),
    h('button', { onClick: () => move(-1), 'aria-label': '上一处匹配' }, '↑'), h('button', { onClick: () => move(1), 'aria-label': '下一处匹配' }, '↓'),
    h('button', { onClick: () => { setSearchOpen(false); setQuery(''); }, 'aria-label': '关闭搜索' }, '×')),
  h('div', { className: 'mdr-reading-layout' },
    showToc && h('nav', { className: 'mdr-toc', 'aria-label': '文档目录' },
      h('div', { className: 'mdr-overline' }, '本页目录'),
      toc.length ? toc.map(item => h('button', { key: item.index, style: { paddingLeft: `${12 + Math.max(0, item.level - 1) * 12}px` }, onClick: () => item.element.scrollIntoView({ block: 'start', behavior: 'instant' }), title: item.text }, item.text)) : h('span', { className: 'mdr-muted' }, '暂无标题')),
    h('div', { ref: scroller, className: 'mdr-page-scroll', onScroll: event => {
      position.current = event.currentTarget.scrollTop; setSelection(null);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save.current(position.current), 350);
    } },
      h('article', { ref: body, className: 'mdr-prose', style: { '--mdr-font-size': `${fontSize}px` }, 'data-reader-body': true },
        h(MarkdownText, { text: doc.text, streaming: false, labels: markdownLabels, pathImages })),
      h('footer', { className: 'mdr-page-end' }, h('span', null, '—'), ' 文档结束 ', h('span', null, '—')))),
  selection && h('button', {
    ref: toolbar, className: 'mdr-quote-action',
    style: { left: `${Math.max(90, Math.min(window.innerWidth - 100, selection.left))}px`, top: `${Math.max(12, selection.top - 44)}px` },
    onPointerDown: event => event.preventDefault(), onClick: ask,
  }, icon('spark'), '提问'));
}
