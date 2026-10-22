import { Service } from '@deepseek-ai/cordis';
import { bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol';
import { createLibrary } from './library.js';
import { readerRemote } from './remote.js';
import { installDocumentContext } from './host-context.js';

export const name = 'dsh-md-reader';
export const inject = ['typert', 'systemPrompt', 'llm', 'dshHomePath'];

class ReaderService extends Service {
  constructor(ctx, library) {
    super(ctx, 'mdReader');
    this.library = library;
    this.typertRemote = bindTypertRemote(this, 'mdReader');
  }
  ownerOnly() {
    const principal = this.ctx.invocation?.peer.principal;
    if (principal && principal.kind !== 'owner') throw new Error('MD 阅读库仅允许本机所有者访问。');
  }
  list() { this.ownerOnly(); return this.library.list(); }
  open(request) { this.ownerOnly(); return this.library.open(request); }
  bind(request) { this.ownerOnly(); return this.library.bind(request); }
  position(request) { this.ownerOnly(); return this.library.position(request); }
}

export async function apply(ctx) {
  const library = await createLibrary(ctx.dshHomePath('dsh-md-reader', 'documents'));
  new ReaderService(ctx, library);
  ctx.typert.register({ package: name, face: 'host', schemas: [], invocations: readerRemote().descriptors, model: {} });
  installDocumentContext(ctx, library);
}
