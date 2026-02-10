// @x402/stacks - Utility functions

import {
  StacksPaymentPayload,
  StacksPaymentRequirement,
  CHAIN_IDS,
  API_URLS,
  NetworkConfig
} from './types.js';

/**
 * Encode a payment payload or requirement to base64 for HTTP headers
 */
export function encodePayment(data: StacksPaymentPayload | StacksPaymentRequirement): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode a base64 encoded payment payload from HTTP header
 */
export function decodePaymentPayload(encoded: string): StacksPaymentPayload {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  return JSON.parse(json) as StacksPaymentPayload;
}

/**
 * Decode a base64 encoded payment requirement from HTTP header
 */
export function decodePaymentRequirement(encoded: string): StacksPaymentRequirement {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  return JSON.parse(json) as StacksPaymentRequirement;
}

/**
 * Convert STX to microSTX
 */
export function stxToMicroStx(stx: number | string): string {
  const stxNum = typeof stx === 'string' ? parseFloat(stx) : stx;
  return Math.round(stxNum * 1_000_000).toString();
}

/**
 * Convert microSTX to STX
 */
export function microStxToStx(microStx: number | string): string {
  const micro = typeof microStx === 'string' ? parseInt(microStx, 10) : microStx;
  return (micro / 1_000_000).toFixed(6);
}

/**
 * Get chain ID for network type
 */
export function getChainId(network: 'mainnet' | 'testnet'): number {
  return network === 'mainnet' ? CHAIN_IDS.MAINNET : CHAIN_IDS.TESTNET;
}

/**
 * Get API URL for network
 */
export function getApiUrl(config: NetworkConfig): string {
  if (config.apiUrl) return config.apiUrl;
  return config.type === 'mainnet' ? API_URLS.MAINNET : API_URLS.TESTNET;
}

/**
 * Validate a Stacks address format
 */
export function isValidStacksAddress(address: string): boolean {
  // Mainnet starts with SP, testnet with ST
  return /^S[PT][A-Z0-9]{38,40}$/.test(address);
}

/**
 * Get network type from chain ID
 */
export function getNetworkFromChainId(chainId: number): 'mainnet' | 'testnet' {
  return chainId === CHAIN_IDS.MAINNET ? 'mainnet' : 'testnet';
}

/**
 * Create a payment requirement for a route
 */
export function createPaymentRequirement(
  recipient: string,
  amount: string,
  options?: {
    description?: string;
    resource?: string;
    chainId?: number;
  }
): StacksPaymentRequirement {
  return {
    scheme: 'exact',
    network: 'stacks',
    chainId: options?.chainId ?? CHAIN_IDS.TESTNET,
    recipient,
    amount,
    asset: 'STX',
    description: options?.description,
    resource: options?.resource,
  };
}
