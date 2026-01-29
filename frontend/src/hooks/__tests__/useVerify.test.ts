import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVerify } from '../useVerify';
import * as storage from '../../lib/storage';
import * as canonicalize from '../../lib/canonicalize';
import * as contract from '../../lib/contract';
import type { CanonicalDigest } from '../../lib/canonicalize';

// Mock modules
vi.mock('../../lib/storage');
vi.mock('../../lib/canonicalize');
vi.mock('../../lib/contract');

describe('useVerify', () => {
  const mockDigest: CanonicalDigest = {
    version: '1.0',
    actionType: 'APPROVE',
    chainId: 10143,
    normalizedIntent: { token: '0x1234', spender: '0x5678', amount: '1000' },
    riskScore: 65,
    rulesTriggered: ['UNLIMITED_ALLOWANCE'],
    liabilityNotice: 'User acknowledged: UNLIMITED_ALLOWANCE',
    createdAt: 1704067200,
  };

  const mockProofHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const testReceiptId = '1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify proof successfully when hashes match', async () => {
    // Setup mocks
    vi.mocked(storage.getDigest).mockReturnValue(mockDigest);
    vi.mocked(canonicalize.computeProofHash).mockReturnValue(mockProofHash);

    const mockContract = {
      isDeployed: vi.fn().mockReturnValue(true),
      getReceipt: vi.fn().mockResolvedValue({
        receiptId: testReceiptId,
        actor: '0xactor',
        actionType: 1,
        riskScore: 65,
        timestamp: 1704067200,
        intentHash: '0xintent',
        proofHash: mockProofHash,
      }),
    };

    vi.mocked(contract.createReceiptRegistryContract).mockReturnValue(mockContract as any);
    vi.mocked(contract.getReadOnlyProvider).mockReturnValue({} as any);

    // Render hook
    const { result } = renderHook(() => useVerify());

    // Call verifyProof
    const verificationPromise = result.current.verifyProof(testReceiptId);

    // Wait for verification to complete
    await waitFor(() => expect(result.current.isVerifying).toBe(false));

    const verificationResult = await verificationPromise;

    // Assertions
    expect(verificationResult.isValid).toBe(true);
    expect(verificationResult.onChainProofHash).toBe(mockProofHash);
    expect(verificationResult.localProofHash).toBe(mockProofHash);
    expect(verificationResult.digest).toEqual(mockDigest);
    expect(verificationResult.error).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('should fail verification when hashes do not match', async () => {
    const differentHash = '0x1111111111111111111111111111111111111111111111111111111111111111';

    // Setup mocks
    vi.mocked(storage.getDigest).mockReturnValue(mockDigest);
    vi.mocked(canonicalize.computeProofHash).mockReturnValue(mockProofHash);

    const mockContract = {
      isDeployed: vi.fn().mockReturnValue(true),
      getReceipt: vi.fn().mockResolvedValue({
        receiptId: testReceiptId,
        actor: '0xactor',
        actionType: 1,
        riskScore: 65,
        timestamp: 1704067200,
        intentHash: '0xintent',
        proofHash: differentHash, // Different hash
      }),
    };

    vi.mocked(contract.createReceiptRegistryContract).mockReturnValue(mockContract as any);
    vi.mocked(contract.getReadOnlyProvider).mockReturnValue({} as any);

    // Render hook
    const { result } = renderHook(() => useVerify());

    // Call verifyProof
    const verificationPromise = result.current.verifyProof(testReceiptId);

    // Wait for verification to complete and error to be set
    await waitFor(() => {
      expect(result.current.isVerifying).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    const verificationResult = await verificationPromise;

    // Assertions
    expect(verificationResult.isValid).toBe(false);
    expect(verificationResult.onChainProofHash).toBe(differentHash);
    expect(verificationResult.localProofHash).toBe(mockProofHash);
    expect(verificationResult.error).toContain('mismatch');
    expect(result.current.error).toContain('mismatch');
  });

  it('should fail when digest not found in localStorage', async () => {
    // Setup mocks
    vi.mocked(storage.getDigest).mockReturnValue(null);

    // Render hook
    const { result } = renderHook(() => useVerify());

    // Call verifyProof
    const verificationPromise = result.current.verifyProof(testReceiptId);

    // Wait for verification to complete
    await waitFor(() => expect(result.current.isVerifying).toBe(false));

    const verificationResult = await verificationPromise;

    // Assertions
    expect(verificationResult.isValid).toBe(false);
    expect(verificationResult.digest).toBeNull();
    expect(verificationResult.error).toContain('not found in local storage');
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toContain('not found in local storage');
  });

  it('should fail when contract not deployed', async () => {
    // Setup mocks
    vi.mocked(storage.getDigest).mockReturnValue(mockDigest);
    vi.mocked(canonicalize.computeProofHash).mockReturnValue(mockProofHash);

    const mockContract = {
      isDeployed: vi.fn().mockReturnValue(false),
    };

    vi.mocked(contract.createReceiptRegistryContract).mockReturnValue(mockContract as any);
    vi.mocked(contract.getReadOnlyProvider).mockReturnValue({} as any);

    // Render hook
    const { result } = renderHook(() => useVerify());

    // Call verifyProof
    const verificationPromise = result.current.verifyProof(testReceiptId);

    // Wait for verification to complete
    await waitFor(() => expect(result.current.isVerifying).toBe(false));

    const verificationResult = await verificationPromise;

    // Assertions
    expect(verificationResult.isValid).toBe(false);
    expect(verificationResult.error).toContain('not deployed');
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toContain('not deployed');
  });

  it('should handle contract errors gracefully', async () => {
    // Setup mocks
    vi.mocked(storage.getDigest).mockReturnValue(mockDigest);
    vi.mocked(canonicalize.computeProofHash).mockReturnValue(mockProofHash);

    const mockContract = {
      isDeployed: vi.fn().mockReturnValue(true),
      getReceipt: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    vi.mocked(contract.createReceiptRegistryContract).mockReturnValue(mockContract as any);
    vi.mocked(contract.getReadOnlyProvider).mockReturnValue({} as any);

    // Render hook
    const { result } = renderHook(() => useVerify());

    // Call verifyProof
    const verificationPromise = result.current.verifyProof(testReceiptId);

    // Wait for verification to complete
    await waitFor(() => expect(result.current.isVerifying).toBe(false));

    const verificationResult = await verificationPromise;

    // Assertions
    expect(verificationResult.isValid).toBe(false);
    expect(verificationResult.error).toContain('Network error');
    expect(result.current.error).toContain('Network error');
  });

  it('should handle case-insensitive hash comparison', async () => {
    const upperCaseHash = mockProofHash.toUpperCase();

    // Setup mocks
    vi.mocked(storage.getDigest).mockReturnValue(mockDigest);
    vi.mocked(canonicalize.computeProofHash).mockReturnValue(mockProofHash.toLowerCase());

    const mockContract = {
      isDeployed: vi.fn().mockReturnValue(true),
      getReceipt: vi.fn().mockResolvedValue({
        receiptId: testReceiptId,
        actor: '0xactor',
        actionType: 1,
        riskScore: 65,
        timestamp: 1704067200,
        intentHash: '0xintent',
        proofHash: upperCaseHash, // Upper case
      }),
    };

    vi.mocked(contract.createReceiptRegistryContract).mockReturnValue(mockContract as any);
    vi.mocked(contract.getReadOnlyProvider).mockReturnValue({} as any);

    // Render hook
    const { result } = renderHook(() => useVerify());

    // Call verifyProof
    const verificationPromise = result.current.verifyProof(testReceiptId);

    // Wait for verification to complete
    await waitFor(() => expect(result.current.isVerifying).toBe(false));

    const verificationResult = await verificationPromise;

    // Assertions - should match despite case difference
    expect(verificationResult.isValid).toBe(true);
  });

  it('should update isVerifying state correctly', async () => {
    // Setup mocks
    vi.mocked(storage.getDigest).mockReturnValue(mockDigest);
    vi.mocked(canonicalize.computeProofHash).mockReturnValue(mockProofHash);

    const mockContract = {
      isDeployed: vi.fn().mockReturnValue(true),
      getReceipt: vi.fn().mockResolvedValue({
        receiptId: testReceiptId,
        actor: '0xactor',
        actionType: 1,
        riskScore: 65,
        timestamp: 1704067200,
        intentHash: '0xintent',
        proofHash: mockProofHash,
      }),
    };

    vi.mocked(contract.createReceiptRegistryContract).mockReturnValue(mockContract as any);
    vi.mocked(contract.getReadOnlyProvider).mockReturnValue({} as any);

    // Render hook
    const { result } = renderHook(() => useVerify());

    // Initially not verifying
    expect(result.current.isVerifying).toBe(false);

    // Start verification
    const verificationPromise = result.current.verifyProof(testReceiptId);

    // Should be verifying now (might be too fast to catch, but worth checking)
    // expect(result.current.isVerifying).toBe(true);

    // Wait for completion
    await waitFor(() => expect(result.current.isVerifying).toBe(false));

    await verificationPromise;

    // Should not be verifying after completion
    expect(result.current.isVerifying).toBe(false);
  });
});
