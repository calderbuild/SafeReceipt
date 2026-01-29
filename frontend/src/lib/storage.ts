import type { CanonicalDigest } from './canonicalize';

/**
 * LocalStorage Storage Solution for SafeReceipt
 *
 * Stores canonical digests and receipt IDs in browser localStorage.
 * This allows users to verify proofs even if the backend is unavailable.
 *
 * Schema:
 * - safereceipt:digest:{receiptId} -> CanonicalDigest JSON
 * - safereceipt:receipts:{address} -> receiptId[]
 */

const STORAGE_PREFIX = 'safereceipt';
const DIGEST_KEY_PREFIX = `${STORAGE_PREFIX}:digest`;
const RECEIPTS_KEY_PREFIX = `${STORAGE_PREFIX}:receipts`;

/**
 * Save a canonical digest to localStorage
 *
 * @param receiptId - Receipt ID
 * @param digest - Canonical digest object
 */
export function saveDigest(receiptId: string, digest: CanonicalDigest): void {
  try {
    const key = `${DIGEST_KEY_PREFIX}:${receiptId}`;
    const value = JSON.stringify(digest);
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('Failed to save digest to localStorage:', error);
    throw new Error('Failed to save digest. Storage may be full.');
  }
}

/**
 * Get a canonical digest from localStorage
 *
 * @param receiptId - Receipt ID
 * @returns Canonical digest or null if not found
 */
export function getDigest(receiptId: string): CanonicalDigest | null {
  try {
    const key = `${DIGEST_KEY_PREFIX}:${receiptId}`;
    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as CanonicalDigest;
  } catch (error) {
    console.error('Failed to get digest from localStorage:', error);
    return null;
  }
}

/**
 * Delete a digest from localStorage
 *
 * @param receiptId - Receipt ID
 */
export function deleteDigest(receiptId: string): void {
  try {
    const key = `${DIGEST_KEY_PREFIX}:${receiptId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to delete digest from localStorage:', error);
  }
}

/**
 * Update digest status and linked transaction hash
 *
 * @param receiptId - Receipt ID
 * @param status - New status (CREATED, EXECUTED, VERIFIED, MISMATCH)
 * @param linkedTxHash - Optional transaction hash that was linked
 */
export function updateDigestStatus(
  receiptId: string,
  status: string,
  linkedTxHash?: string
): void {
  try {
    const digest = getDigest(receiptId);
    if (!digest) {
      throw new Error('Digest not found');
    }

    const updated = {
      ...digest,
      status,
      linkedTxHash,
    };

    saveDigest(receiptId, updated);
  } catch (error) {
    console.error('Failed to update digest status:', error);
    throw new Error('Failed to update digest status.');
  }
}

/**
 * Save receipt ID to user's receipt list
 *
 * @param address - User address
 * @param receiptId - Receipt ID to add
 */
export function addReceiptToUser(address: string, receiptId: string): void {
  try {
    const receipts = getUserReceipts(address);

    // Avoid duplicates
    if (!receipts.includes(receiptId)) {
      receipts.push(receiptId);

      const key = `${RECEIPTS_KEY_PREFIX}:${address.toLowerCase()}`;
      localStorage.setItem(key, JSON.stringify(receipts));
    }
  } catch (error) {
    console.error('Failed to add receipt to user list:', error);
    throw new Error('Failed to save receipt ID.');
  }
}

/**
 * Get all receipt IDs for a user
 *
 * @param address - User address
 * @returns Array of receipt IDs
 */
export function getUserReceipts(address: string): string[] {
  try {
    const key = `${RECEIPTS_KEY_PREFIX}:${address.toLowerCase()}`;
    const value = localStorage.getItem(key);

    if (!value) {
      return [];
    }

    return JSON.parse(value) as string[];
  } catch (error) {
    console.error('Failed to get user receipts from localStorage:', error);
    return [];
  }
}

/**
 * Remove a receipt ID from user's list
 *
 * @param address - User address
 * @param receiptId - Receipt ID to remove
 */
export function removeReceiptFromUser(address: string, receiptId: string): void {
  try {
    const receipts = getUserReceipts(address);
    const filtered = receipts.filter(id => id !== receiptId);

    const key = `${RECEIPTS_KEY_PREFIX}:${address.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove receipt from user list:', error);
  }
}

/**
 * Clear all receipts for a user
 *
 * @param address - User address
 */
export function clearUserReceipts(address: string): void {
  try {
    const key = `${RECEIPTS_KEY_PREFIX}:${address.toLowerCase()}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear user receipts:', error);
  }
}

/**
 * Export all digests for a user
 *
 * @param address - User address
 * @returns Array of {receiptId, digest} objects
 */
export function exportUserData(address: string): Array<{
  receiptId: string;
  digest: CanonicalDigest;
}> {
  const receiptIds = getUserReceipts(address);
  const data: Array<{ receiptId: string; digest: CanonicalDigest }> = [];

  for (const receiptId of receiptIds) {
    const digest = getDigest(receiptId);
    if (digest) {
      data.push({ receiptId, digest });
    }
  }

  return data;
}

/**
 * Export all data as JSON string
 *
 * @param address - User address
 * @returns JSON string of all user data
 */
export function exportUserDataAsJSON(address: string): string {
  const data = exportUserData(address);
  return JSON.stringify(data, null, 2);
}

/**
 * Import user data from JSON
 *
 * @param address - User address
 * @param jsonData - JSON string of user data
 * @returns Number of receipts imported
 */
export function importUserData(address: string, jsonData: string): number {
  try {
    const data = JSON.parse(jsonData) as Array<{
      receiptId: string;
      digest: CanonicalDigest;
    }>;

    let imported = 0;

    for (const item of data) {
      saveDigest(item.receiptId, item.digest);
      addReceiptToUser(address, item.receiptId);
      imported++;
    }

    return imported;
  } catch (error) {
    console.error('Failed to import user data:', error);
    throw new Error('Failed to import data. Invalid JSON format.');
  }
}

/**
 * Clear all SafeReceipt data from localStorage
 */
export function clearAllData(): void {
  try {
    const keys: string[] = [];

    // Get all keys from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        keys.push(key);
      }
    }

    const safeReceiptKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));

    for (const key of safeReceiptKeys) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Failed to clear all data:', error);
  }
}

/**
 * Get storage usage statistics
 *
 * @returns Object with storage stats
 */
export function getStorageStats(): {
  totalDigests: number;
  totalUsers: number;
  estimatedSize: number;
} {
  try {
    const keys: string[] = [];

    // Get all keys from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        keys.push(key);
      }
    }

    const digestKeys = keys.filter(key => key.startsWith(DIGEST_KEY_PREFIX));
    const receiptKeys = keys.filter(key => key.startsWith(RECEIPTS_KEY_PREFIX));

    // Estimate size in bytes
    let estimatedSize = 0;
    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          estimatedSize += key.length + value.length;
        }
      }
    }

    return {
      totalDigests: digestKeys.length,
      totalUsers: receiptKeys.length,
      estimatedSize,
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return {
      totalDigests: 0,
      totalUsers: 0,
      estimatedSize: 0,
    };
  }
}
