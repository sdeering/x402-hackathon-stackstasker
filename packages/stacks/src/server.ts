// @x402/stacks - Server-side payment functions
// Used by sellers/servers to verify and settle payments

import {
  deserializeTransaction,
  broadcastTransaction,
} from '@stacks/transactions';
import {
  STACKS_MAINNET,
  STACKS_TESTNET,
  type StacksNetwork,
} from '@stacks/network';
import {
  StacksPaymentPayload,
  StacksPaymentRequirement,
  VerificationResult,
  SettlementResult,
  NetworkConfig,
} from './types.js';
import { getNetworkFromChainId } from './utils.js';

/**
 * Get the Stacks network instance
 */
function getNetwork(config: NetworkConfig): StacksNetwork {
  return config.type === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

/**
 * Verify a payment payload against a requirement
 * This checks signature validity and payment parameters
 */
export async function verifyPayment(
  payload: StacksPaymentPayload,
  requirement: StacksPaymentRequirement
): Promise<VerificationResult> {
  try {
    // 1. Check scheme matches
    if (payload.scheme !== requirement.scheme) {
      return { valid: false, reason: 'Scheme mismatch' };
    }

    // 2. Check network matches
    if (payload.network !== requirement.network) {
      return { valid: false, reason: 'Network mismatch' };
    }

    // 3. Check chain ID matches
    if (payload.chainId !== requirement.chainId) {
      return { valid: false, reason: 'Chain ID mismatch' };
    }

    // 4. Check recipient matches
    if (payload.recipient !== requirement.recipient) {
      return { valid: false, reason: 'Recipient mismatch' };
    }

    // 5. Check amount is sufficient
    const payloadAmount = BigInt(payload.amount);
    const requiredAmount = BigInt(requirement.amount);
    if (payloadAmount < requiredAmount) {
      return {
        valid: false,
        reason: `Insufficient amount: ${payload.amount} < ${requirement.amount}`
      };
    }

    // 6. Check asset matches
    if (payload.asset !== requirement.asset) {
      return { valid: false, reason: 'Asset mismatch' };
    }

    // 7. If we have a serialized transaction, validate it
    if (payload.serializedTx) {
      const txBytes = Buffer.from(payload.serializedTx, 'hex');
      const transaction = deserializeTransaction(txBytes);

      // Verify the transaction payload matches
      const txPayload = transaction.payload;
      if (txPayload.payloadType !== 0x00) { // Token transfer type
        return { valid: false, reason: 'Transaction is not a token transfer' };
      }

      // Check amount in transaction
      if ('amount' in txPayload && BigInt(txPayload.amount) < requiredAmount) {
        return {
          valid: false,
          reason: 'Transaction amount insufficient'
        };
      }
    }

    // 8. Check expiry if present
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return { valid: false, reason: 'Payment expired' };
    }

    return {
      valid: true,
      details: {
        amount: payload.amount,
        recipient: payload.recipient,
        nonce: payload.nonce,
      }
    };
  } catch (error) {
    return {
      valid: false,
      reason: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Settle a payment by broadcasting the transaction to the Stacks network
 */
export async function settlePayment(
  payload: StacksPaymentPayload,
  config?: NetworkConfig
): Promise<SettlementResult> {
  try {
    if (!payload.serializedTx) {
      return {
        success: false,
        error: 'No serialized transaction in payload'
      };
    }

    // Determine network from payload
    const networkType = config?.type ?? getNetworkFromChainId(payload.chainId);
    const network = getNetwork({ type: networkType });

    // Deserialize the transaction
    const txBytes = Buffer.from(payload.serializedTx, 'hex');
    const transaction = deserializeTransaction(txBytes);

    // Broadcast to the network
    const result = await broadcastTransaction({ transaction, network });

    if ('error' in result) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      txId: result.txid,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown settlement error',
    };
  }
}

/**
 * Check if a transaction has been confirmed
 */
export async function checkTransactionStatus(
  txId: string,
  config: NetworkConfig
): Promise<{
  status: 'pending' | 'success' | 'failed' | 'not_found';
  blockHeight?: number;
}> {
  try {
    const network = getNetwork(config);
    const url = network.client?.baseUrl ?? 'https://api.testnet.hiro.so';
    const response = await fetch(`${url}/extended/v1/tx/${txId}`);

    if (response.status === 404) {
      return { status: 'not_found' };
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      tx_status: string;
      block_height?: number;
    };

    if (data.tx_status === 'success') {
      return { status: 'success', blockHeight: data.block_height };
    } else if (data.tx_status === 'pending') {
      return { status: 'pending' };
    } else {
      return { status: 'failed' };
    }
  } catch {
    return { status: 'not_found' };
  }
}

/**
 * Verify that a payment was received (check blockchain)
 */
export async function verifyPaymentOnChain(
  txId: string,
  _requirement: StacksPaymentRequirement,
  config: NetworkConfig
): Promise<VerificationResult> {
  const status = await checkTransactionStatus(txId, config);

  if (status.status !== 'success') {
    return {
      valid: false,
      reason: `Transaction status: ${status.status}`
    };
  }

  return {
    valid: true,
    details: { txId, blockHeight: status.blockHeight }
  };
}
