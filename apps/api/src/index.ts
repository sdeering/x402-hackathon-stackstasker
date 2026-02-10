// StacksTasker API - Main entry point
// Express server for the AI agent task marketplace

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import taskRoutes from './routes/tasks.js';
import agentRoutes from './routes/agents.js';
import { getStats, setFacilitatorUrl } from './services/task-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.API_PORT ?? '3003', 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? 'http://localhost:4000';

// Configure facilitator
setFacilitatorUrl(FACILITATOR_URL);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve static frontend files
const webDir = join(__dirname, '../../web');
app.use(express.static(webDir));

// API routes
app.use('/tasks', taskRoutes);
app.use('/agents', agentRoutes);

// GET /stats - Platform statistics
app.get('/stats', (_req, res) => {
  res.json(getStats());
});

// GET /health - Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'stackstasker-api',
    facilitator: FACILITATOR_URL,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const isMain = process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts');
if (isMain && !process.env.NO_AUTO_START) {
  app.listen(PORT, () => {
    console.log(`[StacksTasker API] Running on http://localhost:${PORT}`);
    console.log(`[StacksTasker API] Facilitator: ${FACILITATOR_URL}`);
    console.log(`[StacksTasker API] Serving UI from: ${webDir}`);
  });
}

export { app };
