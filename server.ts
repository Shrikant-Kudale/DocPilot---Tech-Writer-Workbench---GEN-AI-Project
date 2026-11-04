/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handleEmbedRequest } from './api/embed';
import { handleChatRequest } from './api/chat';
import { handleParseDocumentRequest } from './api/parse-document';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.post('/api/embed', async (req: Request, res: Response) => {
    try {
      const result = await handleEmbedRequest(req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Embed API route error:', err);
      res.status(500).json({ error: err?.message || 'Embedding generation failed' });
    }
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const result = await handleChatRequest(req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Chat API route error:', err);
      res.status(500).json({ error: err?.message || 'Chat generation failed' });
    }
  });

  app.post('/api/parse-document', async (req: Request, res: Response) => {
    try {
      const result = await handleParseDocumentRequest(req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Parse Document route error:', err);
      res.status(500).json({ error: err?.message || 'Failed to parse document' });
    }
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'DocPilot API',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: PORT,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DocPilot] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DocPilot server:', err);
  process.exit(1);
});
