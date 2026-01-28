import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getDigest } from '../lib/storage';
import { computeProofHash } from '../lib/canonicalize';
import { createReceiptRegistryContract, getReadOnlyProvider } from '../lib/contract';
import type { CanonicalDigest } from '../lib/canonicalize';

export interface VerificationResult {
  isValid: boolean;
  onChainProofHash: string;
  localProofHash: string;
  digest: CanonicalDigest | null;
  error?: string;
}

export interface UseVerifyReturn {
  verifyProof: (receiptId: string) => Promise<VerificationResult>;
  isVerifying: boolean;
  lastResult: VerificationResult | null;
  error: string | null;
}

/**
 * Hook for verifying proof integrity
 *
 * Compares on-chain proofHash with locally computed hash from stored digest
 */
export function useVerify(): UseVerifyReturn {
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyProof = useCallback(async (receiptId: string): Promise<VerificationResult> => {
    setIsVerifying(true);
    setError(null);

    try {
      // Step 1: Get digest from localStorage
      const digest = getDigest(receiptId);

      if (!digest) {
        const result: VerificationResult = {
          isValid: false,
          onChainProofHash: '',
          localProofHash: '',
          digest: null,
          error: 'Digest not found in local storage. Cannot verify proof without original data.',
        };
        setLastResult(result);
        setError(result.error);
        return result;
      }

      // Step 2: Compute local proof hash
      const localProofHash = computeProofHash(digest);

      // Step 3: Get on-chain receipt
      const provider = getReadOnlyProvider();
      const contract = createReceiptRegistryContract(provider as any);

      if (!contract.isDeployed()) {
        const result: VerificationResult = {
          isValid: false,
          onChainProofHash: '',
          localProofHash,
          digest,
          error: 'Contract not deployed. Please deploy the contract first.',
        };
        setLastResult(result);
        setError(result.error);
        return result;
      }

      const receipt = await contract.getReceipt(receiptId);
      const onChainProofHash = receipt.proofHash;

      // Step 4: Compare hashes
      const isValid = onChainProofHash.toLowerCase() === localProofHash.toLowerCase();

      const result: VerificationResult = {
        isValid,
        onChainProofHash,
        localProofHash,
        digest,
        error: isValid ? undefined : 'Proof hash mismatch. The stored digest does not match the on-chain proof.',
      };

      setLastResult(result);
      if (!isValid) {
        setError(result.error!);
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred during verification';
      const result: VerificationResult = {
        isValid: false,
        onChainProofHash: '',
        localProofHash: '',
        digest: null,
        error: errorMessage,
      };

      setLastResult(result);
      setError(errorMessage);
      return result;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  return {
    verifyProof,
    isVerifying,
    lastResult,
    error,
  };
}
