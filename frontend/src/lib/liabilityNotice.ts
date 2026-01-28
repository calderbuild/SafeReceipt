/**
 * Liability Notice Generation
 *
 * Generates deterministic liability notice text based on triggered risk rules.
 * The notice is used to document what risks the user was warned about before
 * approving a transaction.
 */

/**
 * Generate liability notice from triggered rules
 *
 * The notice is deterministic - same rules always produce same notice.
 * Rules are sorted alphabetically before joining.
 *
 * @param rulesTriggered - Array of rule names that were triggered
 * @returns Liability notice string
 */
export function generateLiabilityNotice(rulesTriggered: string[]): string {
  if (!rulesTriggered || rulesTriggered.length === 0) {
    return 'User acknowledged: No risk rules triggered';
  }

  // Sort rules alphabetically for determinism
  const sortedRules = [...rulesTriggered].sort();

  // Join with comma and space
  const rulesText = sortedRules.join(', ');

  return `User acknowledged: ${rulesText}`;
}

/**
 * Generate detailed liability notice with risk score
 *
 * @param rulesTriggered - Array of rule names that were triggered
 * @param riskScore - Risk score (0-100)
 * @returns Detailed liability notice string
 */
export function generateDetailedLiabilityNotice(
  rulesTriggered: string[],
  riskScore: number
): string {
  const baseNotice = generateLiabilityNotice(rulesTriggered);

  if (rulesTriggered.length === 0) {
    return `${baseNotice}. Risk Score: ${riskScore}/100`;
  }

  return `${baseNotice}. Risk Score: ${riskScore}/100. User proceeded despite warnings.`;
}

/**
 * Parse liability notice to extract triggered rules
 *
 * @param notice - Liability notice string
 * @returns Array of rule names
 */
export function parseLiabilityNotice(notice: string): string[] {
  // Extract rules from "User acknowledged: RULE_A, RULE_B" format
  const match = notice.match(/User acknowledged: (.+?)(?:\.|$)/);

  if (!match || match[1] === 'No risk rules triggered') {
    return [];
  }

  // Split by comma and trim whitespace
  return match[1].split(',').map(rule => rule.trim());
}

/**
 * Validate that a liability notice matches the expected format
 *
 * @param notice - Liability notice string
 * @returns true if valid format
 */
export function isValidLiabilityNotice(notice: string): boolean {
  // Must start with "User acknowledged: "
  if (!notice.startsWith('User acknowledged: ')) {
    return false;
  }

  // Must have content after the prefix
  const content = notice.substring('User acknowledged: '.length);
  return content.length > 0;
}
