// @x402/stacks-facilitator - Payment verification logic
// Extracted from @x402/stacks server.ts for standalone facilitator use

import {
  verifyPayment as coreVerify,
  type StacksPaymentPayload,
  type StacksPaymentRequirement,
} from '@x402/stacks';
import type { VerifyResponse } from './types.js';

/**
 * Verify a payment payload against a requirement.
 * Delegates to the core @x402/stacks verification logic.
 */
export async function verifyPayment(
  payload: StacksPaymentPayload,
  requirement: StacksPaymentRequirement
): Promise<VerifyResponse> {
  const result = await coreVerify(payload, requirement);
  return {
    valid: result.valid,
    reason: result.reason,
    details: result.details,
  };
}
