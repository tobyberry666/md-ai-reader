import { makeDocumentContext, checkContextBudget } from './context.js';

export function installDocumentContext(ctx, library) {
  ctx.systemPrompt.context({
    name: 'dsh-md-reader:document', order: 9800, required: true, interpolate: false,
    text: ({ agent }) => {
      const document = agent && library.forSession(agent.id);
      return document ? makeDocumentContext(document) : '';
    },
  });
  ctx.on('agent/request', async ({ agent, signal }, next) => {
    const config = await next();
    const document = library.forSession(agent.id);
    if (document) {
      const info = await ctx.llm.resolveModelInfo(config.provider, config.model, signal);
      checkContextBudget(makeDocumentContext(document), info.context?.contextWindow);
    }
    return config;
  });
}
