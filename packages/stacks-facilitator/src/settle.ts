// @x402/stacks-facilitator - Payment settlement logic
// Extracted from @x402/stacks server.ts for standalone facilitator use

import {
  settlePayment as coreSettle,
  checkTransactionStatus as coreCheckStatus,
  type StacksPaymentPayload,
  type NetworkConfig,
} from '@x402/stacks';
import type { SettleResponse } from './types.js';

/**
 * Settle a payment by broadcasting the transaction to Stacks network.
 * Delegates to the core @x402/stacks settlement logic.
 */
export async function settlePayment(
  payload: StacksPaymentPayload,
  network: 'mainnet' | 'testnet' = 'testnet'
): Promise<SettleResponse> {
  const config: NetworkConfig = { type: network };
  const result = await coreSettle(payload, config);
  return {
    success: result.success,
    txId: result.txId,
    error: result.error,
  };
}

/**
 * Check the status of a previously settled transaction.
 */
export async function checkTransaction(
  txId: string,
  network: 'mainnet' | 'testnet' = 'testnet'
): Promise<{ status: string; blockHeight?: number }> {
  const config: NetworkConfig = { type: network };
  return coreCheckStatus(txId, config);
}
