/**
 * Intent Parser
 *
 * Parses user input into normalized intent objects for risk evaluation.
 * MVP: Structured form input (not AI-powered parsing)
 */

import { ethers } from 'ethers';

// ============================================================================
// Types
// ============================================================================

export interface ApproveIntent {
  token: string;      // Token contract address
  spender: string;    // Spender contract address
  amount: string;     // Amount as string (supports large numbers)
}

export interface BatchPayRecipient {
  address: string;
  amount: string;
}

export interface BatchPayIntent {
  recipients: BatchPayRecipient[];
}

export type ParsedIntent = ApproveIntent | BatchPayIntent;

export interface ParseError {
  field: string;
  message: string;
  line?: number;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors?: ParseError[];
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Validate amount string (must be numeric and non-negative)
 */
export function isValidAmount(amount: string): boolean {
  if (!amount || amount.trim() === '') {
    return false;
  }
  try {
    const bigIntAmount = BigInt(amount);
    return bigIntAmount >= BigInt(0);
  } catch {
    return false;
  }
}

/**
 * Normalize address to checksum format
 */
export function normalizeAddress(address: string): string {
  try {
    return ethers.getAddress(address);
  } catch {
    return address;
  }
}

// ============================================================================
// Approve Intent Parser
// ============================================================================

export interface ApproveFormData {
  token: string;
  spender: string;
  amount: string;
}

/**
 * Parse Approve intent from form data
 * @param formData - Form data with token, spender, amount
 * @returns Parse result with normalized intent or errors
 */
export function parseApproveIntent(
  formData: ApproveFormData
): ParseResult<ApproveIntent> {
  const errors: ParseError[] = [];

  // Validate token address
  if (!formData.token || formData.token.trim() === '') {
    errors.push({
      field: 'token',
      message: 'Token address is required',
    });
  } else if (!isValidAddress(formData.token)) {
    errors.push({
      field: 'token',
      message: 'Invalid token address format',
    });
  }

  // Validate spender address
  if (!formData.spender || formData.spender.trim() === '') {
    errors.push({
      field: 'spender',
      message: 'Spender address is required',
    });
  } else if (!isValidAddress(formData.spender)) {
    errors.push({
      field: 'spender',
      message: 'Invalid spender address format',
    });
  }

  // Validate amount
  if (!formData.amount || formData.amount.trim() === '') {
    errors.push({
      field: 'amount',
      message: 'Amount is required',
    });
  } else if (!isValidAmount(formData.amount)) {
    errors.push({
      field: 'amount',
      message: 'Invalid amount (must be a non-negative number)',
    });
  }

  // Return errors if any
  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  // Normalize and return intent
  const intent: ApproveIntent = {
    token: normalizeAddress(formData.token),
    spender: normalizeAddress(formData.spender),
    amount: formData.amount.trim(),
  };

  return {
    success: true,
    data: intent,
  };
}

// ============================================================================
// BatchPay Intent Parser
// ============================================================================

/**
 * Parse CSV line into recipient
 * Expected format: "address,amount"
 */
function parseCSVLine(line: string, lineNumber: number): ParseResult<BatchPayRecipient> {
  const trimmed = line.trim();

  // Skip empty lines
  if (trimmed === '') {
    return {
      success: true,
      data: undefined,
    };
  }

  // Split by comma
  const parts = trimmed.split(',').map(p => p.trim());

  if (parts.length !== 2) {
    return {
      success: false,
      errors: [{
        field: 'csv',
        message: `Line ${lineNumber}: Expected format "address,amount"`,
        line: lineNumber,
      }],
    };
  }

  const [address, amount] = parts;

  // Validate address
  if (!isValidAddress(address)) {
    return {
      success: false,
      errors: [{
        field: 'csv',
        message: `Line ${lineNumber}: Invalid address "${address}"`,
        line: lineNumber,
      }],
    };
  }

  // Validate amount
  if (!isValidAmount(amount)) {
    return {
      success: false,
      errors: [{
        field: 'csv',
        message: `Line ${lineNumber}: Invalid amount "${amount}"`,
        line: lineNumber,
      }],
    };
  }

  return {
    success: true,
    data: {
      address: normalizeAddress(address),
      amount,
    },
  };
}

/**
 * Parse BatchPay intent from CSV text
 * @param csvText - CSV text with format "address,amount" per line
 * @returns Parse result with normalized intent or errors
 */
export function parseBatchPayIntent(csvText: string): ParseResult<BatchPayIntent> {
  const errors: ParseError[] = [];
  const recipients: BatchPayRecipient[] = [];

  if (csvText === undefined || csvText === null || csvText === '') {
    return {
      success: false,
      errors: [{
        field: 'csv',
        message: 'CSV text is required',
      }],
    };
  }

  const lines = csvText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const result = parseCSVLine(lines[i], lineNumber);

    if (!result.success && result.errors) {
      errors.push(...result.errors);
    } else if (result.data) {
      recipients.push(result.data);
    }
  }

  // Check if we have any recipients
  if (recipients.length === 0 && errors.length === 0) {
    return {
      success: false,
      errors: [{
        field: 'csv',
        message: 'No valid recipients found',
      }],
    };
  }

  // Return errors if any
  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      recipients,
    },
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create unlimited approval amount (max uint256)
 */
export function createUnlimitedAmount(): string {
  return ethers.MaxUint256.toString();
}

/**
 * Parse amount from human-readable format (e.g., "1.5" ETH with 18 decimals)
 * @param amount - Human-readable amount (e.g., "1.5")
 * @param decimals - Token decimals (default: 18)
 * @returns Amount as string in smallest unit
 */
export function parseHumanAmount(amount: string, decimals: number = 18): string {
  try {
    return ethers.parseUnits(amount, decimals).toString();
  } catch (error) {
    throw new Error(`Invalid amount format: ${amount}`);
  }
}

/**
 * Format amount to human-readable format
 * @param amount - Amount as string in smallest unit
 * @param decimals - Token decimals (default: 18)
 * @returns Human-readable amount (e.g., "1.5")
 */
export function formatHumanAmount(amount: string, decimals: number = 18): string {
  try {
    return ethers.formatUnits(amount, decimals);
  } catch (error) {
    throw new Error(`Invalid amount: ${amount}`);
  }
}

/**
 * Check if amount is unlimited (max uint256)
 */
export function isUnlimitedAmount(amount: string): boolean {
  try {
    return BigInt(amount) === ethers.MaxUint256;
  } catch {
    return false;
  }
}
