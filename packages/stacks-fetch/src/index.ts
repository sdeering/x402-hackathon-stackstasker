// @x402/stacks-fetch - Fetch wrapper for automatic x402 Stacks payments

import {
  createPaymentPayload,
  encodePayment,
  decodePaymentRequirement,
  getWalletAddress,
  getBalance,
  type WalletConfig,
  type NetworkConfig,
  type StacksPaymentRequirement,
} from '@x402/stacks';

/**
 * Configuration for the x402 fetch wrapper
 */
export interface X402FetchConfig {
  /** Wallet configuration for signing payments */
  wallet: WalletConfig;
  /** Network configuration */
  network?: NetworkConfig;
  /** Maximum auto-pay amount in microSTX (default: 10000000 = 10 STX) */
  maxAutoPayAmount?: string;
  /** Callback when payment is made */
  onPayment?: (info: PaymentInfo) => void;
  /** Custom fee in microSTX (optional) */
  fee?: string;
}

/**
 * Information about a payment that was made
 */
export interface PaymentInfo {
  url: string;
  amount: string;
  recipient: string;
  txId?: string;
}

/**
 * Header names used by x402 protocol
 */
const HEADERS = {
  PAYMENT_REQUIRED: 'x-payment-required',
  PAYMENT_SIGNATURE: 'X-Payment',
  PAYMENT_RESPONSE: 'x-payment-response',
} as const;

/**
 * Create a fetch wrapper that automatically handles x402 payments
 */
export function wrapFetch(
  fetchFn: typeof fetch,
  config: X402FetchConfig
): typeof fetch {
  const {
    wallet,
    network = { type: 'testnet' },
    maxAutoPayAmount = '10000000', // 10 STX default max
    onPayment,
    fee,
  } = config;

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    // Make the initial request
    const response = await fetchFn(input, init);

    // If not 402, return the response as-is
    if (response.status !== 402) {
      return response;
    }

    // Get payment requirement from header
    const paymentRequiredHeader = response.headers.get(HEADERS.PAYMENT_REQUIRED);
    if (!paymentRequiredHeader) {
      // 402 without payment info, return original response
      return response;
    }

    // Decode the payment requirement
    let requirement: StacksPaymentRequirement;
    try {
      requirement = decodePaymentRequirement(paymentRequiredHeader);
    } catch {
      console.error('[x402] Failed to decode payment requirement');
      return response;
    }

    // Check if amount is within our limit
    if (BigInt(requirement.amount) > BigInt(maxAutoPayAmount)) {
      console.warn(
        `[x402] Payment amount ${requirement.amount} exceeds max ${maxAutoPayAmount}, not auto-paying`
      );
      return response;
    }

    // Log payment intent
    console.log(`[x402] Paying ${requirement.amount} microSTX to ${requirement.recipient}`);

    // Create and sign the payment
    const payload = await createPaymentPayload(requirement, wallet, { fee });

    // Encode the payment for the header
    const paymentHeader = encodePayment(payload);

    // Retry the request with payment
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const retryResponse = await fetchFn(input, {
      ...init,
      headers: {
        ...init?.headers,
        [HEADERS.PAYMENT_SIGNATURE]: paymentHeader,
      },
    });

    // Get payment response info
    const paymentResponseHeader = retryResponse.headers.get(HEADERS.PAYMENT_RESPONSE);
    let txId: string | undefined;
    if (paymentResponseHeader) {
      try {
        const paymentResponse = JSON.parse(paymentResponseHeader);
        txId = paymentResponse.txId;
      } catch {
        // Ignore parse errors
      }
    }

    // Call payment callback if provided
    if (onPayment) {
      onPayment({
        url,
        amount: requirement.amount,
        recipient: requirement.recipient,
        txId,
      });
    }

    return retryResponse;
  };
}

/**
 * Create a simple x402 fetch function with wallet config
 */
export function createX402Fetch(config: X402FetchConfig): typeof fetch {
  return wrapFetch(fetch, config);
}

/**
 * Utility to check wallet balance before making requests
 */
export async function checkWalletBalance(
  config: X402FetchConfig
): Promise<{ address: string; balance: string; sufficient: boolean }> {
  const network = config.network ?? { type: 'testnet' as const };
  const address = getWalletAddress(
    config.wallet.privateKey,
    network.type
  );
  const balanceInfo = await getBalance(address, network);

  return {
    address,
    balance: balanceInfo.stx,
    sufficient: BigInt(balanceInfo.stx) > 0,
  };
}
