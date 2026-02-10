// @x402/stacks - Client-side payment functions
// Used by buyers/clients to create and sign payments

import {
  makeSTXTokenTransfer,
  getAddressFromPrivateKey,
  serializeTransaction,
  fetchNonce,
} from '@stacks/transactions';
import {
  STACKS_MAINNET,
  STACKS_TESTNET,
  type StacksNetwork,
} from '@stacks/network';
import {
  StacksPaymentPayload,
  StacksPaymentRequirement,
  WalletConfig,
  NetworkConfig,
  CHAIN_IDS,
} from './types.js';
import { getNetworkFromChainId } from './utils.js';

/**
 * Get the Stacks network instance
 */
function getNetwork(config: NetworkConfig): StacksNetwork {
  return config.type === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

/**
 * Create a payment payload for a given requirement
 * This builds and signs an STX transfer transaction
 */
export async function createPaymentPayload(
  requirement: StacksPaymentRequirement,
  wallet: WalletConfig,
  options?: {
    nonce?: number;
    fee?: string;
  }
): Promise<StacksPaymentPayload> {
  const networkType = getNetworkFromChainId(requirement.chainId);
  const network = getNetwork({ type: networkType });

  // Get sender address from private key
  const senderAddress = wallet.address ?? getAddressFromPrivateKey(wallet.privateKey);

  // Get nonce if not provided
  let nonce: bigint;
  if (options?.nonce !== undefined) {
    nonce = BigInt(options.nonce);
  } else {
    nonce = await fetchNonce({ address: senderAddress, network });
  }

  // Create the STX transfer transaction
  const txOptions: Parameters<typeof makeSTXTokenTransfer>[0] = {
    recipient: requirement.recipient,
    amount: BigInt(requirement.amount),
    senderKey: wallet.privateKey,
    network,
    nonce,
  };

  // Only add fee if explicitly provided
  if (options?.fee) {
    txOptions.fee = BigInt(options.fee);
  }

  const transaction = await makeSTXTokenTransfer(txOptions);

  // Serialize the transaction (returns hex string in stacks.js v7+)
  const serializedTx = serializeTransaction(transaction);

  // Get signature from the transaction auth
  const auth = transaction.auth;
  const spendingCondition = auth.spendingCondition;

  // For single-sig transactions
  const signature = 'signature' in spendingCondition
    ? Buffer.from(spendingCondition.signature.data).toString('hex')
    : '';
  const publicKey = Buffer.from(spendingCondition.signer).toString('hex');

  return {
    scheme: 'exact',
    network: 'stacks',
    chainId: requirement.chainId,
    recipient: requirement.recipient,
    amount: requirement.amount,
    asset: 'STX',
    nonce: Number(nonce),
    signature,
    publicKey,
    serializedTx,
  };
}

/**
 * Get wallet address from private key
 */
export function getWalletAddress(
  privateKey: string,
  network: 'mainnet' | 'testnet' = 'testnet'
): string {
  const stacksNetwork = network === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
  return getAddressFromPrivateKey(privateKey, stacksNetwork);
}

/**
 * Check wallet balance
 */
export async function getBalance(
  address: string,
  config: NetworkConfig
): Promise<{ stx: string; locked: string }> {
  const network = getNetwork(config);
  const url = network.client?.baseUrl ?? 'https://api.testnet.hiro.so';
  const response = await fetch(`${url}/extended/v1/address/${address}/stx`);
  if (!response.ok) {
    throw new Error(`Failed to fetch balance: ${response.statusText}`);
  }
  const data = await response.json() as { balance: string; locked: string };
  return {
    stx: data.balance,
    locked: data.locked,
  };
}
