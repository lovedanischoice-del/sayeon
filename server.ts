/**
 * 사연쇼츠 스튜디오 - Full Stack Express Entrypoint
 * Port 3000, Vite Middleware integration in dev, production static serving.
 */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes.js';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // Basic Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS for local worker communication
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, idempotency-key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Dynamic quickstart.ps1 script injection with current server URL
  app.get('/quickstart.ps1', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const serverUrl = `${protocol}://${host}`;
    const filePath = path.resolve(process.cwd(), 'public', 'quickstart.ps1');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const substituted = raw.replace(/\$ServerUrl = "[^"]*"/, `$ServerUrl = "${serverUrl}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(substituted);
    }
    return res.status(404).send('# quickstart.ps1 not found');
  });

  // Serve public assets (worker bundle zip, quickstart script)
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Mount API Router
  app.use('/api', apiRouter);

  // Vite dev middleware or static serving
  if (isDev) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[사연쇼츠 스튜디오] Server running at http://0.0.0.0:${PORT}`);
    console.log(`[사연쇼츠 스튜디오] Environment: ${isDev ? 'Development (Vite middleware)' : 'Production'}`);
  });
}

startServer().catch((err) => {
  console.error('[사연쇼츠 스튜디오] Fatal server startup error:', err);
  process.exit(1);
});
