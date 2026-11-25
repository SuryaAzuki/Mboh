import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { attachLanWebSocketServer, getLanAddresses } from './server/lanServer';
import { generateAndroidCapacitorZip } from './server/androidPackager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  attachLanWebSocketServer(server);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, port: PORT });
  });

  app.get('/api/lan-info', (_req, res) => {
    const interfaces = getLanAddresses(PORT);
    res.json({
      port: PORT,
      interfaces,
      androidSdkInstalledInContainer: false,
    });
  });

  app.get('/api/android-bundle.zip', async (req, res) => {
    try {
      const lanUrlParam = typeof req.query.lanUrl === 'string' ? req.query.lanUrl : '';
      const interfaces = getLanAddresses(PORT);
      const defaultLanUrl = lanUrlParam || (interfaces[0]?.wsUrl ?? '');
      const zipBuffer = await generateAndroidCapacitorZip(__dirname, defaultLanUrl);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="ApexGP-LAN-MotoGP-Android-APK-Project.zip"',
      );
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err) {
      console.error('Failed to generate Android APK project bundle:', err);
      res.status(500).json({ error: 'Failed to generate Android bundle' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    const lans = getLanAddresses(PORT);
    console.log(`APEX GP Server running on http://0.0.0.0:${PORT}`);
    if (lans.length > 0) {
      console.log(`LAN URLs: ${lans.map((l) => l.httpUrl).join(', ')}`);
    }
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
