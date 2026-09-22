import Fastify from 'fastify';

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  app.get('/health', async () => ({ ok: true as const }));

  return app;
}
