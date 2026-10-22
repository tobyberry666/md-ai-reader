function requestCodec(method) {
  return {
    mode: 'strict', typeSymbol: `dsh-md-reader#${method}:request`,
    create: () => ({ parse(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求必须为对象。');
      const allowed = method === 'bind' ? ['id', 'name', 'text', 'sourcePath', 'sessionId'] : method === 'position' ? ['id', 'scrollTop'] : ['id'];
      if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('请求包含未知字段。');
      if (typeof value.id !== 'string' || !/^[a-f0-9]{64}$/.test(value.id)) throw new Error('无效的文档标识。');
      if (method === 'bind' && (typeof value.name !== 'string' || typeof value.text !== 'string' || typeof value.sessionId !== 'string' || value.sourcePath !== undefined && typeof value.sourcePath !== 'string')) throw new Error('无效的文档。');
      if (method === 'position' && (!Number.isFinite(value.scrollTop) || value.scrollTop < 0)) throw new Error('无效的阅读位置。');
      return value;
    } }),
  };
}

export function readerRemote() {
  const descriptors = ['list', 'open', 'bind', 'position'].map(method => ({
    id: `dsh-md-reader#mdReader/${method}`,
    namespace: 'mdReader', method, service: 'mdReader', invocation: { kind: 'direct' },
    parameters: method === 'list' ? [] : [{ name: 'request', wire: 'request', source: 'json', codec: requestCodec(method) }],
    result: { mode: 'src-json' },
  }));
  return { package: 'dsh-md-reader', descriptors };
}
