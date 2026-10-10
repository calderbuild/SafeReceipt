import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Serves api/agent.ts and api/traces.ts under `npm run dev`, the way Vercel does in production.
function agentApiDev(): Plugin {
  return {
    name: 'agent-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/agent', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const { handle } = await server.ssrLoadModule('/api/agent.ts');
        const response: Response = await handle(new Request(`http://localhost${req.originalUrl}`, {
          method: req.method,
          headers: { 'Content-Type': 'application/json', 'x-real-ip': req.socket.remoteAddress ?? 'local' },
          body: req.method === 'POST' ? Buffer.concat(chunks).toString() : undefined,
        }));
        res.statusCode = response.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(await response.text());
      });
      // Same rewrite as vercel.json: /api/traces/<chain>/<file> -> ?chain=&file=
      server.middlewares.use('/api/traces', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const url = new URL(`http://localhost${req.originalUrl}`);
        const m = url.pathname.match(/^\/api\/traces\/([^/]+)\/([^/]+)$/);
        if (m) url.search = `?chain=${m[1]}&file=${m[2]}`;
        const { handle } = await server.ssrLoadModule('/api/traces.ts');
        const response: Response = await handle(new Request(url, {
          method: req.method,
          headers: { 'Content-Type': 'application/json', 'x-real-ip': req.socket.remoteAddress ?? 'local' },
          body: req.method === 'POST' ? Buffer.concat(chunks).toString() : undefined,
        }));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Non-VITE_ vars stay server-side; this only feeds the dev middleware above.
  const env = loadEnv(mode, process.cwd(), '')
  process.env.DEEPSEEK_API_KEY ??= env.DEEPSEEK_API_KEY
  process.env.BLOB_READ_WRITE_TOKEN ??= env.BLOB_READ_WRITE_TOKEN
  return {
    plugins: [react(), agentApiDev()],
    build: {
      rollupOptions: {
        output: {
          // Vendor code changes rarely; separate chunks stay cached across deploys.
          manualChunks: {
            ethers: ['ethers'],
            react: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  }
})
