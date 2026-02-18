import { ethers } from 'ethers';

/**
 * Canonical Digest Structure
 *
 * Field order is FIXED and MUST NOT be changed:
 * version, actionType, chainId, normalizedIntent, riskScore, rulesTriggered, liabilityNotice, createdAt
 */
export interface CanonicalDigest {
  version: string;           // "1.0"
  actionType: string;        // "APPROVE" | "BATCH_PAY"
  chainId: number;           // 84532 for Base Sepolia
  normalizedIntent: object;  // Keys alphabetically sorted
  riskScore: number;         // 0-100
  rulesTriggered: string[];  // Alphabetically sorted
  liabilityNotice: string;   // Deterministic notice text
  createdAt: number;         // Unix timestamp in seconds (integer)
  // Runtime fields (not included in hash computation)
  status?: string;           // CREATED, EXECUTED, VERIFIED, MISMATCH
  linkedTxHash?: string;     // Transaction hash linked to this receipt
}

/**
 * Recursively sort object keys alphabetically
 *
 * @param obj - Object to sort
 * @returns New object with sorted keys
 */
export function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item));
  }

  // Handle non-object primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Sort object keys
  const sorted: any = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }

  return sorted;
}

/**
 * Generate canonical JSON string from digest
 *
 * Rules:
 * - Field order is fixed (see CanonicalDigest interface)
 * - rulesTriggered array is alphabetically sorted
 * - normalizedIntent keys are alphabetically sorted
 * - No whitespace (compact JSON)
 * - Amounts must be strings
 *
 * @param digest - Canonical digest object
 * @returns Compact JSON string
 */
export function canonicalizeDigest(digest: CanonicalDigest): string {
  // Ensure rulesTriggered is sorted
  const sortedRules = [...digest.rulesTriggered].sort();

  // Ensure normalizedIntent keys are sorted
  const sortedIntent = sortObjectKeys(digest.normalizedIntent);

  // Build canonical object with FIXED field order
  const canonical = {
    version: digest.version,
    actionType: digest.actionType,
    chainId: digest.chainId,
    normalizedIntent: sortedIntent,
    riskScore: digest.riskScore,
    rulesTriggered: sortedRules,
    liabilityNotice: digest.liabilityNotice,
    createdAt: digest.createdAt,
  };

  // Generate compact JSON (no whitespace)
  return JSON.stringify(canonical);
}

/**
 * Compute intent hash from normalized intent
 *
 * @param normalizedIntent - Intent object with sorted keys
 * @returns keccak256 hash as hex string (0x...)
 */
export function computeIntentHash(normalizedIntent: object): string {
  const sortedIntent = sortObjectKeys(normalizedIntent);
  const intentJson = JSON.stringify(sortedIntent);
  const intentBytes = ethers.toUtf8Bytes(intentJson);
  return ethers.keccak256(intentBytes);
}

/**
 * Compute proof hash from canonical digest
 *
 * @param digest - Canonical digest object
 * @returns keccak256 hash as hex string (0x...)
 */
export function computeProofHash(digest: CanonicalDigest): string {
  const canonicalJson = canonicalizeDigest(digest);
  const digestBytes = ethers.toUtf8Bytes(canonicalJson);
  return ethers.keccak256(digestBytes);
}

/**
 * Create a canonical digest from input data
 *
 * @param params - Input parameters
 * @returns Canonical digest object
 */
export interface CreateDigestParams {
  actionType: 'APPROVE' | 'BATCH_PAY';
  normalizedIntent: object;
  riskScore: number;
  rulesTriggered: string[];
  liabilityNotice: string;
  chainId?: number;
  createdAt?: number;
}

export function createCanonicalDigest(params: CreateDigestParams): CanonicalDigest {
  return {
    version: '1.0',
    actionType: params.actionType,
    chainId: params.chainId || 84532, // Default to Base Sepolia
    normalizedIntent: sortObjectKeys(params.normalizedIntent),
    riskScore: params.riskScore,
    rulesTriggered: [...params.rulesTriggered].sort(),
    liabilityNotice: params.liabilityNotice,
    createdAt: params.createdAt || Math.floor(Date.now() / 1000), // Unix timestamp in seconds
  };
}

/**
 * Verify that a proof hash matches the canonical digest
 *
 * @param digest - Canonical digest object
 * @param expectedProofHash - Expected proof hash from chain
 * @returns true if hashes match
 */
export function verifyProofHash(digest: CanonicalDigest, expectedProofHash: string): boolean {
  const computedHash = computeProofHash(digest);
  return computedHash.toLowerCase() === expectedProofHash.toLowerCase();
}
