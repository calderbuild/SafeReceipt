import { ethers } from "ethers";

/**
 * Deterministic canonicalization for off-chain action traces.
 *
 * Mirrors the exact rules in frontend/src/lib/canonicalize.ts so a trace hashed
 * here reproduces byte-for-byte in the browser's "Verify Independently" path:
 *   - recursively sort object keys alphabetically
 *   - compact JSON (no whitespace)
 *   - keccak256 over UTF-8 bytes
 *
 * Runtime-only fields (status, linkedTxHash, outcomeHash) are stripped before
 * hashing, same as the frontend excludes its runtime fields.
 */
export function sortObjectKeys(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (typeof obj !== "object") return obj;

  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

const RUNTIME_FIELDS = new Set(["status", "linkedTxHash", "outcomeHash"]);

export function canonicalize(trace) {
  const stripped = {};
  for (const key of Object.keys(trace)) {
    if (!RUNTIME_FIELDS.has(key)) stripped[key] = trace[key];
  }
  return JSON.stringify(sortObjectKeys(stripped));
}

export function hashTrace(trace) {
  return ethers.keccak256(ethers.toUtf8Bytes(canonicalize(trace)));
}

export function hashIntent(normalizedIntent) {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(sortObjectKeys(normalizedIntent))));
}
