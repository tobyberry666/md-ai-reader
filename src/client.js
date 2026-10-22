export const inject = ['slots', 'sessions', 'conversation', 'inputTriggers', 'remote', 'layout'];

const h = React.createElement;
const iconPaths = {
  book: 'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3V4Z',
  search: 'm21 21-5-5M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z',
  toc: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  spark: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z',
  back: 'm14 5-7 7 7 7M7 12h14',
};

function icon(name, size = 18) {
  return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: iconPaths[name] }));
}

export async function apply(ctx) {
  const cache = new Map();
  const id = 'md-reader';
  await ctx.remote.$mount(readerRemote());
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-md-reader'; style.textContent = READER_CSS;
    document.head.append(style);
    return () => { style.remove(); cache.clear(); };
  });
  ctx.effect(() => registerQuoteSource(ctx, async documentId => cache.get(documentId) || remoteValue(ctx.remote.mdReader.open({ id: documentId }))));

  function NativeConversation({ sessionId, useSession, renderFactorySlot }) {
    const session = useSession(state => state);
    return h('div', { className: 'mdr-native', 'data-md-reader-session': sessionId },
      session?.blank && h('div', { className: 'mdr-chat-welcome' }, icon('spark', 28), h('h3', null, '从一个问题开始'), h('p', null, '选中左侧的文字提问，', h('br'), '也可以直接询问整篇文档。')),
      renderFactorySlot('conversation.content', { variant: 'embedded', hero: false, phase: 'active' }));
  }

  function Page({ SessionProvider, renderSlot }) {
    const [library, setLibrary] = React.useState([]);
    const [tabs, setTabs] = React.useState([]);
    const [activeId, setActiveId] = React.useState(null);
    const [active, setActive] = React.useState(null);
    const [sessionReference, setSessionReference] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [dragging, setDragging] = React.useState(false);
    const [split, setSplit] = React.useState(65);
    const fileInput = React.useRef(null);
    const container = React.useRef(null);
    const depth = React.useRef(0);
    const importing = React.useRef(false);
    const mounted = React.useRef(true);

    React.useEffect(() => {
      mounted.current = true;
      remoteValue(ctx.remote.mdReader.list()).then(items => {
        if (!mounted.current) return;
        setLibrary(items);
        const savedId = localStorage.getItem('dsh-md-reader:active');
        const saved = items.find(item => item.id === savedId);
        if (saved) { setTabs([saved.id]); setActiveId(saved.id); }
      }).catch(reason => { if (mounted.current) setError(reason.message); }).finally(() => { if (mounted.current) setLoading(false); });
      return () => { mounted.current = false; };
    }, []);

    React.useEffect(() => {
      let cancelled = false;
      let reference;
      setActive(null); setSessionReference(null);
      if (!activeId) return;
      setLoading(true); setError('');
      (async () => {
        const doc = cache.get(activeId) || await remoteValue(ctx.remote.mdReader.open({ id: activeId }));
        cache.set(doc.id, doc);
        reference = await retainDocumentSession(ctx, doc);
        if (cancelled) { reference.release(); return; }
        localStorage.setItem('dsh-md-reader:active', doc.id);
        setActive(doc); setSessionReference(reference); setLoading(false);
      })().catch(reason => { if (!cancelled) { setError(reason.message); setLoading(false); } });
      return () => { cancelled = true; reference?.release(); };
    }, [activeId]);

    const open = item => { setTabs(previous => previous.includes(item.id) ? previous : [...previous, item.id]); setActiveId(item.id); };
    const importFiles = async files => {
      if (importing.current) return;
      importing.current = true; setBusy(true); setError('');
      try {
        for (const file of files) {
          const sourcePath = globalThis.__DSH_HOST_PATHS__?.pathFor(file) || '';
          const doc = await readMarkdownFile(file, sourcePath);
          let entry = library.find(item => item.id === doc.id);
          if (!entry) {
            const sessionId = await ctx.sessions.create();
            entry = await remoteValue(ctx.remote.mdReader.bind({ ...doc, sessionId }));
            const stored = await remoteValue(ctx.remote.mdReader.open({ id: doc.id }));
            cache.set(doc.id, stored);
            if (mounted.current) setLibrary(previous => [entry, ...previous.filter(item => item.id !== entry.id)]);
          }
          if (mounted.current) open(entry);
        }
      } catch (reason) { if (mounted.current) setError(reason.message); }
      finally { importing.current = false; if (mounted.current) setBusy(false); }
    };
    const closeTab = tabId => {
      const next = tabs.filter(value => value !== tabId); setTabs(next);
      if (activeId === tabId) { setActiveId(next.at(-1) || null); if (!next.length) localStorage.removeItem('dsh-md-reader:active'); }
    };
    const savePosition = (doc, top) => {
      cache.set(doc.id, { ...doc, scrollTop: top });
      remoteValue(ctx.remote.mdReader.position({ id: doc.id, scrollTop: top })).catch(reason => { if (mounted.current) setError(`阅读位置保存失败：${reason.message}`); });
    };
    const quote = text => {
      try { insertQuote(ctx, active, text); setError(''); }
      catch (reason) { setError(reason.message); }
    };
    const resize = event => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const box = container.current.getBoundingClientRect();
      setSplit(Math.max(35, Math.min(75, (event.clientX - box.left) / box.width * 100)));
    };
    return h('div', {
      className: 'mdr-app',
      onDragEnter: event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); depth.current++; setDragging(true); } },
      onDragOver: event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; } },
      onDragLeave: event => { event.preventDefault(); if (--depth.current <= 0) { depth.current = 0; setDragging(false); } },
      onDrop: event => { event.preventDefault(); event.stopPropagation(); depth.current = 0; setDragging(false); if (event.dataTransfer.files.length) importFiles([...event.dataTransfer.files]); },
    },
    h('input', { ref: fileInput, type: 'file', accept: '.md,.markdown', multiple: true, hidden: true, 'aria-label': '选择 Markdown 文件', onChange: event => { importFiles([...event.target.files]); event.target.value = ''; } }),
    h('header', { className: 'mdr-header' },
      h('div', { className: 'mdr-brand' }, h('button', { className: 'mdr-icon-button', 'aria-label': '返回 DSH 对话', title: '返回对话', onClick: () => ctx.layout.selectPanel(null) }, icon('back')), h('span', { className: 'mdr-brand-icon' }, icon('book', 21)), h('span', null, 'MD 阅读'), h('span', { className: 'mdr-header-note' }, 'READ & ASK')),
      h('button', { className: 'mdr-import', disabled: busy, onClick: () => fileInput.current.click() }, icon('upload', 15), busy ? '正在导入…' : '导入文档')),
    error && h('div', { className: 'mdr-error', role: 'alert' }, h('span', null, error), h('button', { 'aria-label': '关闭错误提示', onClick: () => setError('') }, '×')),
    tabs.length > 0 && h('div', { className: 'mdr-tabs', role: 'tablist', 'aria-label': '打开的文档' }, tabs.map(tabId => {
      const doc = library.find(item => item.id === tabId);
      return h('div', { className: 'mdr-tab', 'data-active': activeId === tabId, key: tabId },
        h('button', { role: 'tab', 'aria-selected': activeId === tabId, onClick: () => setActiveId(tabId), title: doc?.name }, icon('book', 14), doc?.name || 'Markdown'),
        h('button', { className: 'mdr-close-tab', 'aria-label': `关闭 ${doc?.name || '文档'}`, onClick: () => closeTab(tabId) }, '×'));
    })),
    active && sessionReference ? h('main', { ref: container, className: 'mdr-split', style: { '--mdr-split': `${split}%` } },
      h(Reader, { key: active.id, document: active, onQuote: quote, onPosition: top => savePosition(active, top) }),
      h('div', {
        className: 'mdr-divider', role: 'separator', tabIndex: 0, 'aria-label': '调整阅读区和对话区宽度', 'aria-orientation': 'vertical', 'aria-valuenow': Math.round(split), 'aria-valuemin': 35, 'aria-valuemax': 75,
        onPointerDown: event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }, onPointerMove: resize,
        onPointerUp: event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); },
        onKeyDown: event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSplit(v => Math.max(35, Math.min(75, v + (event.key === 'ArrowLeft' ? -2 : 2)))); } },
      }),
      h('aside', { className: 'mdr-chat', 'aria-label': '文档 AI 对话' },
        h('div', { className: 'mdr-chat-heading' }, h('span', null, icon('spark', 17), '与文档对话'), h('span', { className: 'mdr-context-ready', title: `已将 ${active.name} 的完整原文注册为此会话的上下文；模型调用沿用 DSH。` }, h('i'), '全文已接入')),
        h(SessionProvider, { session: sessionReference }, renderSlot('md-reader.conversation', {})))) :
      h('main', { className: 'mdr-empty' },
        loading ? h('p', { role: 'status' }, '正在连接文档会话…') : h(React.Fragment, null,
          h('div', { className: 'mdr-empty-book' }, icon('book', 46)), h('div', { className: 'mdr-overline' }, 'A QUIET PLACE TO READ'),
          h('h1', null, '读懂每一页'), h('p', null, '拖入 Markdown，开始与文档对话。', h('br'), '让阅读保持专注，让问题随时得到回应。'),
          h('button', { className: 'mdr-import mdr-empty-import', disabled: busy, onClick: () => fileInput.current.click() }, icon('upload'), '选择 Markdown 文件'),
          h('span', { className: 'mdr-muted' }, '.md / .markdown · 拖放即可打开'),
          library.length > 0 && h('section', { className: 'mdr-recents', 'aria-label': '最近阅读' }, h('h2', null, '继续阅读'), library.slice(0, 8).map(item => h('button', { key: item.id, onClick: () => open(item) }, icon('book', 17), h('span', null, item.name), h('span', { className: 'mdr-muted' }, '继续 →')))))),
    dragging && h('div', { className: 'mdr-drop-cover' }, icon('upload', 44), h('h2', null, '松开，开始阅读'), h('p', null, '导入 Markdown 文件')));
  }

  ctx.slots.inject('main', function* () {
    yield ctx.slots.register({ name: 'main', key: id, children: { 'md-reader.conversation': { kind: 'single', scope: 'session' } } }, Page);
    yield ctx.slots.register({ name: 'md-reader.conversation' }, NativeConversation);
  });
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id, order: 35, label: 'MD 阅读' }, () => icon('book')));
}
