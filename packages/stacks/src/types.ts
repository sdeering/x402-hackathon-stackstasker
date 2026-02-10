// @x402/stacks - Type definitions for Stacks payment protocol
// Compatible with x402 spec: https://docs.x402.org

/**
 * Stacks-specific payment payload for x402 protocol
 * Sent in PAYMENT-SIGNATURE header after receiving 402
 */
export interface StacksPaymentPayload {
  /** Payment scheme - always 'exact' for direct payments */
  scheme: 'exact';
  /** Network identifier */
  network: 'stacks';
  /** Chain ID: 1 = mainnet, 2147483648 = testnet */
  chainId: number;
  /** Recipient STX address */
  recipient: string;
  /** Amount in microSTX (1 STX = 1,000,000 microSTX) */
  amount: string;
  /** Asset type: 'STX' for native, or SIP-10 contract address */
  asset: 'STX' | string;
  /** Transaction nonce for replay protection */
  nonce: number;
  /** Stacks signature of the transaction */
  signature: string;
  /** Sender's public key */
  publicKey: string;
  /** Optional: serialized transaction for settlement */
  serializedTx?: string;
  /** Expiry timestamp (optional) */
  expiresAt?: number;
}

/**
 * Payment requirement returned in PAYMENT-REQUIRED header (402 response)
 */
export interface StacksPaymentRequirement {
  /** Payment scheme */
  scheme: 'exact';
  /** Network identifier */
  network: 'stacks';
  /** Chain ID */
  chainId: number;
  /** Recipient address to pay */
  recipient: string;
  /** Required amount in microSTX */
  amount: string;
  /** Asset type */
  asset: 'STX';
  /** Human-readable description of what's being paid for */
  description?: string;
  /** Resource identifier (URL or endpoint) */
  resource?: string;
  /** Optional: maximum age of payment in seconds */
  maxAge?: number;
}

/**
 * Verification result from verifyPayment
 */
export interface VerificationResult {
  /** Whether the payment is valid */
  valid: boolean;
  /** Reason for rejection if invalid */
  reason?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Settlement result from settlePayment
 */
export interface SettlementResult {
  /** Whether settlement succeeded */
  success: boolean;
  /** Transaction ID on Stacks blockchain */
  txId?: string;
  /** Error message if failed */
  error?: string;
  /** Block height if confirmed */
  blockHeight?: number;
}

/**
 * Wallet configuration for signing payments
 */
export interface WalletConfig {
  /** Private key in hex format (without 0x prefix) */
  privateKey: string;
  /** Optional: Stacks address (derived from privateKey if not provided) */
  address?: string;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Network type */
  type: 'mainnet' | 'testnet';
  /** Optional: custom API URL */
  apiUrl?: string;
}

/**
 * Constants for Stacks chain IDs
 */
export const CHAIN_IDS = {
  MAINNET: 1,
  TESTNET: 2147483648, // 0x80000000
} as const;

/**
 * Default Stacks API URLs
 */
export const API_URLS = {
  MAINNET: 'https://api.mainnet.hiro.so',
  TESTNET: 'https://api.testnet.hiro.so',
} as const;
