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

// Parse CLI flags (e.g. npm run dev -- --port 3050 or -p 3001)
const cliArgs = process.argv.slice(2);
const portFlagIndex = cliArgs.findIndex((arg) => arg === '--port' || arg === '-p');
const cliPort = portFlagIndex !== -1 && cliArgs[portFlagIndex + 1] ? Number(cliArgs[portFlagIndex + 1]) : null;
const initialPort = cliPort || Number(process.env.PORT) || 3000;

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
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${initialPort}`;
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

  function listenOnPort(port: number, retriesLeft = 10) {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`[사연쇼츠 스튜디오] Server running at http://localhost:${port} (0.0.0.0:${port})`);
      console.log(`[사연쇼츠 스튜디오] Environment: ${isDev ? 'Development (Vite middleware)' : 'Production'}`);
      console.log(`[Worker 실행 안내] powershell -ExecutionPolicy Bypass -File scripts\\start_worker.ps1 -ServerUrl "http://localhost:${port}" -Mode "real"`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        if (retriesLeft > 0) {
          const nextPort = port + 1;
          console.warn(`[사연쇼츠 스튜디오] 포트 ${port}가 이미 사용 중입니다. 다음 포트 ${nextPort}로 자동 재시도합니다...`);
          listenOnPort(nextPort, retriesLeft - 1);
        } else {
          console.error('[사연쇼츠 스튜디오] 포트 바인딩 실패: 사용 가능한 포트를 찾지 못했습니다.');
          process.exit(1);
        }
      } else {
        console.error('[사연쇼츠 스튜디오] Server error:', err);
      }
    });
  }

  listenOnPort(initialPort);
}

startServer().catch((err) => {
  console.error('[사연쇼츠 스튜디오] Fatal server startup error:', err);
  process.exit(1);
});
