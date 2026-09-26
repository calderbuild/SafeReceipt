import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Serves api/agent.ts under `npm run dev`, the way Vercel does in production.
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
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Non-VITE_ vars stay server-side; this only feeds the dev middleware above.
  process.env.DEEPSEEK_API_KEY ??= loadEnv(mode, process.cwd(), '').DEEPSEEK_API_KEY
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
