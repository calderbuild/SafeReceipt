/**
 * Export Evidence - Complete dispute arbitration evidence
 *
 * Generates a JSON file containing all necessary info for:
 * 1. On-chain verification
 * 2. Dispute arbitration
 * 3. Audit trail
 */

import type { CanonicalDigest } from './canonicalize';
import { computeIntentHash, computeProofHash } from './canonicalize';
import { ACTIVE_CHAIN, CONTRACT_CONFIG } from './contract';

export interface ExportedEvidence {
  // Version info
  version: string;
  exportedAt: string;

  // Receipt ID
  receiptId: string;
  chainId: number;
  contractAddress: string;
  actionType: string;
  digestVersion: string;

  // Participant info
  actor: string;

  // Hash proofs
  intentHash: string;
  proofHash: string;

  // Original data
  normalizedIntent: object;
  riskScore: number;
  rulesTriggered: string[];
  liabilityNotice: string;

  // Timestamps
  createdAt: number;
  createdAtISO: string;

  // On-chain info
  transactionHash?: string;
  blockNumber?: number;
  /** Execution tx linked to this receipt and the verdict, as last seen by this browser. */
  linkedTxHash?: string;
  status?: string;

  // Verification guide
  verificationInstructions: string;

  // Links
  links: {
    explorer?: string;
    verifyUrl?: string;
  };
}

/**
 * Create export evidence object
 */
export function createExportEvidence(
  receiptId: string,
  digest: CanonicalDigest,
  actor: string,
  txHash?: string,
  blockNumber?: number
): ExportedEvidence {
  const intentHash = computeIntentHash(digest.normalizedIntent);
  const proofHash = computeProofHash(digest);

  const evidence: ExportedEvidence = {
    version: '1.0',
    exportedAt: new Date().toISOString(),

    receiptId,
    chainId: digest.chainId,
    contractAddress: CONTRACT_CONFIG.address,
    actionType: digest.actionType,
    digestVersion: digest.version,

    actor,

    intentHash,
    proofHash,

    normalizedIntent: digest.normalizedIntent,
    riskScore: digest.riskScore,
    rulesTriggered: digest.rulesTriggered,
    liabilityNotice: digest.liabilityNotice,

    createdAt: digest.createdAt,
    createdAtISO: new Date(digest.createdAt * 1000).toISOString(),

    transactionHash: txHash,
    blockNumber,
    linkedTxHash: digest.linkedTxHash,
    status: digest.status,

    verificationInstructions: generateVerificationInstructions(receiptId, digest.chainId),

    links: {
      explorer: `${ACTIVE_CHAIN.blockExplorer}/address/${CONTRACT_CONFIG.address}`,
    },
  };

  return evidence;
}

/**
 * Generate verification instructions
 */
function generateVerificationInstructions(receiptId: string, chainId: number): string {
  return `
Verification Steps:

1. Fetch On-Chain Data
   - Access the SafeReceipt contract
   - Call getReceipt(${receiptId})
   - Retrieve the stored proofHash

2. Local Verification
   - Use digestVersion (as version), actionType, chainId, normalizedIntent, riskScore,
     rulesTriggered, liabilityNotice and createdAt from this file
   - Recompute hash following CanonicalDigest format
   - Field order: version, actionType, chainId, normalizedIntent, riskScore, rulesTriggered, liabilityNotice, createdAt
   - Compute proofHash using keccak256

3. Compare
   - Compare on-chain proofHash with locally computed hash
   - If they match, data integrity is proven
   - If they don't match, data may have been tampered with

Chain Info:
- Chain ID: ${chainId}
- Network: ${ACTIVE_CHAIN.name}
- RPC: ${ACTIVE_CHAIN.rpcUrl}

This evidence file can be used for dispute arbitration, proving the user's true intent before transaction execution.
`.trim();
}

/**
 * Export as JSON file
 */
export function exportAsJSON(evidence: ExportedEvidence): string {
  return JSON.stringify(evidence, null, 2);
}

/**
 * Download evidence file
 */
export function downloadEvidence(evidence: ExportedEvidence): void {
  const json = exportAsJSON(evidence);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `safereceipt-evidence-${evidence.receiptId}-${Date.now()}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Quick export function
 */
export function exportAndDownload(
  receiptId: string,
  digest: CanonicalDigest,
  actor: string,
  txHash?: string,
  blockNumber?: number
): void {
  const evidence = createExportEvidence(receiptId, digest, actor, txHash, blockNumber);
  downloadEvidence(evidence);
}
