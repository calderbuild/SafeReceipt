/**
 * useExecutionVerifier Hook
 *
 * Verifies that a transaction matches the declared intent in a receipt.
 * Fetches the tx from chain, decodes calldata, compares to stored intent.
 */

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getDigest } from '../lib/storage';
import { MONAD_TESTNET } from '../lib/contract';

export interface VerificationResult {
  isVerified: boolean;
  txHash: string;
  details: {
    intentSpender?: string;
    intentAmount?: string;
    intentToken?: string;
    txTo?: string;
    txData?: string;
    decodedSpender?: string;
    decodedAmount?: string;
  };
  mismatchReasons: string[];
  error?: string;
}

// ERC20 approve function signature
const APPROVE_SELECTOR = '0x095ea7b3';

// ERC20 approve ABI for decoding
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
];

/**
 * Decode ERC20 approve calldata
 */
function decodeApproveCalldata(data: string): { spender: string; amount: string } | null {
  try {
    if (!data.startsWith(APPROVE_SELECTOR)) {
      return null;
    }

    const iface = new ethers.Interface(ERC20_ABI);
    const decoded = iface.decodeFunctionData('approve', data);

    return {
      spender: decoded[0].toLowerCase(),
      amount: decoded[1].toString(),
    };
  } catch {
    return null;
  }
}

export function useExecutionVerifier() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null);

  /**
   * Verify a transaction against a receipt's intent
   */
  const verifyExecution = useCallback(
    async (receiptId: string, txHash: string): Promise<VerificationResult> => {
      setIsVerifying(true);

      try {
        // 1. Get stored digest from localStorage
        const digest = getDigest(receiptId);
        if (!digest) {
          const result: VerificationResult = {
            isVerified: false,
            txHash,
            details: {},
            mismatchReasons: ['Receipt not found in local storage'],
            error: 'Receipt not found',
          };
          setLastResult(result);
          return result;
        }

        // 2. Fetch transaction from chain
        const provider = new ethers.JsonRpcProvider(MONAD_TESTNET.rpcUrl);
        const tx = await provider.getTransaction(txHash);

        if (!tx) {
          const result: VerificationResult = {
            isVerified: false,
            txHash,
            details: {},
            mismatchReasons: ['Transaction not found on chain'],
            error: 'Transaction not found',
          };
          setLastResult(result);
          return result;
        }

        // 3. Extract intent from digest
        const intent = digest.normalizedIntent as {
          token?: string;
          spender?: string;
          amount?: string;
        };

        const mismatchReasons: string[] = [];
        const details: VerificationResult['details'] = {
          intentToken: intent.token,
          intentSpender: intent.spender,
          intentAmount: intent.amount,
          txTo: tx.to || undefined,
          txData: tx.data,
        };

        // 4. For APPROVE action, verify the calldata
        if (digest.actionType === 'APPROVE') {
          // tx.to should be the token address
          if (tx.to?.toLowerCase() !== intent.token?.toLowerCase()) {
            mismatchReasons.push(
              `Token mismatch: intent=${intent.token}, tx.to=${tx.to}`
            );
          }

          // Decode the approve calldata
          const decoded = decodeApproveCalldata(tx.data);
          if (!decoded) {
            mismatchReasons.push('Transaction is not an ERC20 approve call');
          } else {
            details.decodedSpender = decoded.spender;
            details.decodedAmount = decoded.amount;

            // Check spender
            if (decoded.spender !== intent.spender?.toLowerCase()) {
              mismatchReasons.push(
                `Spender mismatch: intent=${intent.spender}, tx=${decoded.spender}`
              );
            }

            // Check amount (allow for slight variations due to decimals handling)
            if (decoded.amount !== intent.amount) {
              mismatchReasons.push(
                `Amount mismatch: intent=${intent.amount}, tx=${decoded.amount}`
              );
            }
          }
        } else if (digest.actionType === 'BATCH_PAY') {
          // For batch pay, we'd need more complex verification
          // For MVP, just check that tx exists
          mismatchReasons.push('BATCH_PAY verification not yet implemented');
        }

        const isVerified = mismatchReasons.length === 0;

        const result: VerificationResult = {
          isVerified,
          txHash,
          details,
          mismatchReasons,
        };

        setLastResult(result);
        return result;
      } catch (error: any) {
        const result: VerificationResult = {
          isVerified: false,
          txHash,
          details: {},
          mismatchReasons: [error.message],
          error: error.message,
        };
        setLastResult(result);
        return result;
      } finally {
        setIsVerifying(false);
      }
    },
    []
  );

  return {
    verifyExecution,
    isVerifying,
    lastResult,
  };
}
