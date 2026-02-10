// @x402/stacks-facilitator - Standalone x402 facilitator service
// Implements the x402 V2 facilitator spec: /verify, /settle, /supported, /health

import express from 'express';
import cors from 'cors';
import { verifyPayment } from './verify.js';
import { settlePayment, checkTransaction } from './settle.js';
import type {
  FacilitatorConfig,
  VerifyRequest,
  SettleRequest,
  SupportedResponse,
} from './types.js';

export { verifyPayment } from './verify.js';
export { settlePayment, checkTransaction } from './settle.js';
export type * from './types.js';

/**
 * Create and start the facilitator Express server
 */
export function createFacilitator(config: FacilitatorConfig = {}) {
  const {
    port = 4000,
    network = 'testnet',
    corsOrigin = '*',
  } = config;

  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  // POST /verify - Verify a payment payload against a requirement
  app.post('/verify', async (req, res) => {
    try {
      const { payload, requirement } = req.body as VerifyRequest;

      if (!payload || !requirement) {
        res.status(400).json({ valid: false, reason: 'Missing payload or requirement' });
        return;
      }

      const result = await verifyPayment(payload, requirement);
      res.json(result);
    } catch (error) {
      console.error('[facilitator] Verify error:', error);
      res.status(500).json({
        valid: false,
        reason: error instanceof Error ? error.message : 'Internal error',
      });
    }
  });

  // POST /settle - Settle a verified payment on the Stacks network
  app.post('/settle', async (req, res) => {
    try {
      const { payload, network: reqNetwork } = req.body as SettleRequest;

      if (!payload) {
        res.status(400).json({ success: false, error: 'Missing payload' });
        return;
      }

      const result = await settlePayment(payload, reqNetwork ?? network);
      res.json(result);
    } catch (error) {
      console.error('[facilitator] Settle error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  });

  // GET /supported - Return supported payment schemes, networks, assets
  app.get('/supported', (_req, res) => {
    const supported: SupportedResponse = {
      schemes: ['exact'],
      networks: ['stacks'],
      assets: ['STX'],
    };
    res.json(supported);
  });

  // GET /health - Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'x402-stacks-facilitator',
      network,
      timestamp: new Date().toISOString(),
    });
  });

  // GET /tx/:txId - Check transaction status
  app.get('/tx/:txId', async (req, res) => {
    try {
      const result = await checkTransaction(req.params.txId, network);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return { app, port };
}

/**
 * Start the facilitator server
 */
export function startFacilitator(config: FacilitatorConfig = {}) {
  const { app, port } = createFacilitator(config);

  const server = app.listen(port, () => {
    console.log(`[x402 Facilitator] Running on http://localhost:${port}`);
    console.log(`[x402 Facilitator] Network: ${config.network ?? 'testnet'}`);
    console.log(`[x402 Facilitator] Endpoints: /verify, /settle, /supported, /health`);
  });

  return server;
}

// Allow running directly
const isMain = process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts');
if (isMain && !process.env.NO_AUTO_START) {
  startFacilitator({
    port: parseInt(process.env.FACILITATOR_PORT ?? '4000', 10),
    network: (process.env.STACKS_NETWORK as 'mainnet' | 'testnet') ?? 'testnet',
  });
}
