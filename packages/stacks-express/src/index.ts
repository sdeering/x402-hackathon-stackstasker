// @x402/stacks-express - Express middleware for x402 Stacks payments
// Supports optional facilitator delegation for verification + settlement

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  verifyPayment,
  settlePayment,
  encodePayment,
  decodePaymentPayload,
  createPaymentRequirement,
  stxToMicroStx,
  CHAIN_IDS,
  type StacksPaymentPayload,
  type StacksPaymentRequirement,
  type NetworkConfig,
} from '@x402/stacks';

/**
 * Configuration for a paid route
 */
export interface RouteConfig {
  /** Price in STX (e.g., "0.001") */
  price: string;
  /** Asset type (default: 'STX') */
  asset?: 'STX';
  /** Description of the service */
  description?: string;
}

/**
 * Middleware options
 */
export interface PaymentMiddlewareOptions {
  /** Recipient address for payments */
  recipientAddress: string;
  /** Network configuration */
  network?: NetworkConfig;
  /** Whether to settle payments immediately (default: true) */
  settleImmediately?: boolean;
  /** URL of the x402 facilitator service (e.g., "http://localhost:4000") */
  facilitatorUrl?: string;
  /** Custom verification function */
  customVerify?: (
    payload: StacksPaymentPayload,
    requirement: StacksPaymentRequirement,
    req: Request
  ) => Promise<boolean>;
}

/**
 * Header names used by x402 protocol
 */
const HEADERS = {
  PAYMENT_REQUIRED: 'X-Payment-Required',
  PAYMENT_SIGNATURE: 'X-Payment',
  PAYMENT_RESPONSE: 'X-Payment-Response',
} as const;

/**
 * Create a route key from method and path
 */
function getRouteKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * Verify payment via facilitator service
 */
async function verifyViaFacilitator(
  facilitatorUrl: string,
  payload: StacksPaymentPayload,
  requirement: StacksPaymentRequirement
): Promise<{ valid: boolean; reason?: string }> {
  const response = await fetch(`${facilitatorUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, requirement }),
  });
  return response.json() as Promise<{ valid: boolean; reason?: string }>;
}

/**
 * Settle payment via facilitator service
 */
async function settleViaFacilitator(
  facilitatorUrl: string,
  payload: StacksPaymentPayload
): Promise<{ success: boolean; txId?: string; error?: string }> {
  const response = await fetch(`${facilitatorUrl}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  return response.json() as Promise<{ success: boolean; txId?: string; error?: string }>;
}

/**
 * Create Express middleware for x402 Stacks payments
 *
 * Supports optional facilitator delegation: when `facilitatorUrl` is set,
 * verification and settlement are delegated to the facilitator service
 * instead of running locally.
 */
export function paymentMiddleware(
  routes: Record<string, RouteConfig>,
  options: PaymentMiddlewareOptions
): RequestHandler {
  const {
    recipientAddress,
    network = { type: 'testnet' },
    settleImmediately = true,
    facilitatorUrl,
  } = options;

  const chainId = network.type === 'mainnet' ? CHAIN_IDS.MAINNET : CHAIN_IDS.TESTNET;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if this route requires payment
      const routeKey = getRouteKey(req.method, req.path);
      const config = routes[routeKey];

      // No payment required for this route
      if (!config) {
        next();
        return;
      }

      // Create payment requirement
      const requirement = createPaymentRequirement(
        recipientAddress,
        stxToMicroStx(config.price),
        {
          description: config.description,
          resource: routeKey,
          chainId,
        }
      );

      // Check for payment header
      const paymentHeader = req.headers[HEADERS.PAYMENT_SIGNATURE.toLowerCase()] as string | undefined;

      if (!paymentHeader) {
        // Return 402 Payment Required
        res.status(402)
          .set(HEADERS.PAYMENT_REQUIRED, encodePayment(requirement))
          .json({
            error: 'Payment Required',
            message: config.description ?? 'This endpoint requires payment',
            requirement: {
              amount: config.price,
              asset: 'STX',
              recipient: recipientAddress,
            },
          });
        return;
      }

      // Decode and verify payment
      let payload: StacksPaymentPayload;
      try {
        payload = decodePaymentPayload(paymentHeader);
      } catch {
        res.status(400).json({ error: 'Invalid payment header format' });
        return;
      }

      // Verify payment (via facilitator or locally)
      let verification: { valid: boolean; reason?: string };
      if (facilitatorUrl) {
        verification = await verifyViaFacilitator(facilitatorUrl, payload, requirement);
      } else {
        verification = await verifyPayment(payload, requirement);
      }

      if (!verification.valid) {
        res.status(402)
          .set(HEADERS.PAYMENT_REQUIRED, encodePayment(requirement))
          .json({
            error: 'Payment Invalid',
            reason: verification.reason,
          });
        return;
      }

      // Custom verification if provided
      if (options.customVerify) {
        const customValid = await options.customVerify(payload, requirement, req);
        if (!customValid) {
          res.status(402)
            .set(HEADERS.PAYMENT_REQUIRED, encodePayment(requirement))
            .json({ error: 'Payment rejected by custom verification' });
          return;
        }
      }

      // Settle payment if configured
      if (settleImmediately) {
        let settlement: { success: boolean; txId?: string; error?: string };

        if (facilitatorUrl) {
          settlement = await settleViaFacilitator(facilitatorUrl, payload);
        } else {
          settlement = await settlePayment(payload, network);
        }

        if (!settlement.success) {
          res.status(402)
            .set(HEADERS.PAYMENT_REQUIRED, encodePayment(requirement))
            .json({
              error: 'Payment Settlement Failed',
              reason: settlement.error,
            });
          return;
        }

        // Add settlement info to response header
        res.set(HEADERS.PAYMENT_RESPONSE, JSON.stringify({
          txId: settlement.txId,
          settled: true,
        }));

        // Store settlement info on request for handler use
        (req as any).x402Payment = {
          txId: settlement.txId,
          amount: payload.amount,
          sender: payload.publicKey,
        };
      }

      // Payment verified (and settled if configured), proceed to handler
      next();
    } catch (error) {
      console.error('[x402] Middleware error:', error);
      res.status(500).json({
        error: 'Payment processing error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Express middleware type augmentation
 */
declare global {
  namespace Express {
    interface Request {
      x402Payment?: {
        txId: string;
        amount: string;
        sender: string;
      };
    }
  }
}
