/**
 * useExecutionVerifier Hook
 *
 * Checks a mined transaction against a receipt: the declared intent comes from
 * the local digest (and must hash to the on-chain intentHash), the actor and
 * creation time come from the chain. Lookup failures set `error` and are never
 * reported as a mismatch.
 */

import { useState, useCallback } from 'react';
import { getDigest } from '../lib/storage';
import { createReceiptRegistryContract, getReadOnlyProvider } from '../lib/contract';
import { computeIntentHash } from '../lib/canonicalize';
import { fetchApproveExecution } from '../lib/verifyExecution';
import type { ApproveIntentFields } from '../lib/verifyExecution';
import { messageOf } from '../lib/errors';

export interface VerificationResult {
  isVerified: boolean;
  txHash: string;
  mismatchReasons: string[];
  error?: string;
}

export function useExecutionVerifier() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null);

  const verifyExecution = useCallback(async (receiptId: string, txHash: string): Promise<VerificationResult> => {
    setIsVerifying(true);
    const done = (r: VerificationResult) => {
      setLastResult(r);
      return r;
    };
    const fail = (error: string) => done({ isVerified: false, txHash, mismatchReasons: [], error });

    try {
      const digest = getDigest(receiptId);
      if (!digest) return fail('Receipt not found in this browser');
      if (digest.actionType !== 'APPROVE') return fail('Execution checks cover APPROVE receipts only');

      const provider = getReadOnlyProvider();
      const onChain = await createReceiptRegistryContract(provider).getReceipt(receiptId);
      const intent = digest.normalizedIntent as ApproveIntentFields;

      const check = await fetchApproveExecution(provider, txHash, intent, onChain.actor, onChain.timestamp);
      const reasons = [...check.mismatchReasons];
      if (computeIntentHash(digest.normalizedIntent) !== onChain.intentHash) {
        reasons.unshift('Local intent does not hash to the on-chain intentHash');
      }
      return done({ isVerified: reasons.length === 0, txHash, mismatchReasons: reasons });
    } catch (error) {
      return fail(messageOf(error));
    } finally {
      setIsVerifying(false);
    }
  }, []);

  return { verifyExecution, isVerifying, lastResult };
}
