/**
 * Wallet Error Handling
 *
 * User-friendly error messages and recovery suggestions
 */

export interface WalletError {
  code: string;
  title: string;
  message: string;
  suggestion?: string;
  recoverable: boolean;
}

// MetaMask error code mapping
const METAMASK_ERROR_CODES: Record<number | string, WalletError> = {
  // User rejected
  4001: {
    code: 'USER_REJECTED',
    title: 'Operation Cancelled',
    message: 'You cancelled the operation',
    suggestion: 'To continue, please try again and confirm in your wallet',
    recoverable: true,
  },

  // Request pending
  '-32002': {
    code: 'REQUEST_PENDING',
    title: 'Request Pending',
    message: 'A request is already pending',
    suggestion: 'Check your MetaMask extension for pending requests',
    recoverable: true,
  },

  // Chain not added
  4902: {
    code: 'CHAIN_NOT_ADDED',
    title: 'Network Not Added',
    message: 'Base Sepolia has not been added to your wallet',
    suggestion: 'Please allow adding the Base Sepolia network',
    recoverable: true,
  },

  // Internal error
  '-32603': {
    code: 'INTERNAL_ERROR',
    title: 'Internal Error',
    message: 'The wallet encountered an internal error',
    suggestion: 'Please refresh the page and try again',
    recoverable: true,
  },
};

// Error message pattern mapping
const ERROR_MESSAGE_PATTERNS: Array<{
  pattern: RegExp;
  error: WalletError;
}> = [
  {
    pattern: /insufficient funds/i,
    error: {
      code: 'INSUFFICIENT_FUNDS',
      title: 'Insufficient Gas',
      message: 'Your account balance is insufficient for gas fees',
      suggestion: 'Get test ETH from Base Sepolia Faucet: https://app.optimism.io/faucet',
      recoverable: true,
    },
  },
  {
    pattern: /gas required exceeds allowance/i,
    error: {
      code: 'GAS_LIMIT_EXCEEDED',
      title: 'Gas Limit Exceeded',
      message: 'Transaction requires more gas than allowed',
      suggestion: 'Try reducing the transaction size or try again later',
      recoverable: true,
    },
  },
  {
    pattern: /nonce too low/i,
    error: {
      code: 'NONCE_TOO_LOW',
      title: 'Nonce Error',
      message: 'Transaction nonce is too low',
      suggestion: 'Reset your account in MetaMask or wait for pending transactions to complete',
      recoverable: true,
    },
  },
  {
    pattern: /replacement transaction underpriced/i,
    error: {
      code: 'REPLACEMENT_UNDERPRICED',
      title: 'Replacement Underpriced',
      message: 'New transaction gas price is lower than the pending transaction',
      suggestion: 'Wait for the original transaction to complete or use a higher gas price',
      recoverable: true,
    },
  },
  {
    pattern: /network changed/i,
    error: {
      code: 'NETWORK_CHANGED',
      title: 'Network Changed',
      message: 'A network change was detected',
      suggestion: 'Please make sure you are on Base Sepolia',
      recoverable: true,
    },
  },
  {
    pattern: /user denied/i,
    error: {
      code: 'USER_DENIED',
      title: 'Operation Denied',
      message: 'You denied the operation',
      suggestion: 'To continue, please try again',
      recoverable: true,
    },
  },
  {
    pattern: /disconnected/i,
    error: {
      code: 'DISCONNECTED',
      title: 'Wallet Disconnected',
      message: 'The wallet connection was lost',
      suggestion: 'Please reconnect your wallet',
      recoverable: true,
    },
  },
  {
    pattern: /timeout/i,
    error: {
      code: 'TIMEOUT',
      title: 'Request Timeout',
      message: 'The operation timed out',
      suggestion: 'Check your network connection and try again',
      recoverable: true,
    },
  },
];

/**
 * Parse wallet error into user-friendly format
 */
export function parseWalletError(error: unknown): WalletError {
  if (!error) {
    return {
      code: 'UNKNOWN',
      title: 'Unknown Error',
      message: 'An unknown error occurred',
      suggestion: 'Please refresh the page and try again',
      recoverable: true,
    };
  }

  const err = error as Record<string, unknown>;

  // Check error code
  const code = err.code as number | string | undefined;
  if (code && METAMASK_ERROR_CODES[code]) {
    return METAMASK_ERROR_CODES[code];
  }

  // Check error message
  const message = (err.message as string) || (err.reason as string) || String(error);

  for (const { pattern, error: walletError } of ERROR_MESSAGE_PATTERNS) {
    if (pattern.test(message)) {
      return walletError;
    }
  }

  // Default error
  return {
    code: 'UNKNOWN',
    title: 'Operation Failed',
    message: message.length > 100 ? message.substring(0, 100) + '...' : message,
    suggestion: 'Please try again later',
    recoverable: true,
  };
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  const walletError = parseWalletError(error);
  return walletError.message;
}

/**
 * Get full error info with suggestion
 */
export function getErrorWithSuggestion(error: unknown): {
  title: string;
  message: string;
  suggestion?: string;
} {
  const walletError = parseWalletError(error);
  return {
    title: walletError.title,
    message: walletError.message,
    suggestion: walletError.suggestion,
  };
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  const walletError = parseWalletError(error);
  return walletError.recoverable;
}

/**
 * Check if error is a user rejection
 */
export function isUserRejection(error: unknown): boolean {
  const walletError = parseWalletError(error);
  return walletError.code === 'USER_REJECTED' || walletError.code === 'USER_DENIED';
}
