// @x402/stacks-facilitator - Facilitator-specific types

import type { StacksPaymentPayload, StacksPaymentRequirement } from '@x402/stacks';

/**
 * Request body for POST /verify
 */
export interface VerifyRequest {
  payload: StacksPaymentPayload;
  requirement: StacksPaymentRequirement;
}

/**
 * Response body for POST /verify
 */
export interface VerifyResponse {
  valid: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

/**
 * Request body for POST /settle
 */
export interface SettleRequest {
  payload: StacksPaymentPayload;
  network?: 'mainnet' | 'testnet';
}

/**
 * Response body for POST /settle
 */
export interface SettleResponse {
  success: boolean;
  txId?: string;
  error?: string;
}

/**
 * Response body for GET /supported
 */
export interface SupportedResponse {
  schemes: string[];
  networks: string[];
  assets: string[];
}

/**
 * Facilitator configuration
 */
export interface FacilitatorConfig {
  /** Port to listen on (default: 4000) */
  port?: number;
  /** Network type (default: 'testnet') */
  network?: 'mainnet' | 'testnet';
  /** CORS origin (default: '*') */
  corsOrigin?: string;
}
