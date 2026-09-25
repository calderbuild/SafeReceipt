/**
 * Liability Notice Generation
 *
 * Deterministic text recording which risk rules fired when the receipt was
 * created (rules sorted, so the same rules always give the same text; the
 * notice is part of the hashed digest).
 *
 * Receipts created before 2026-09 say "User acknowledged: ..." instead. That
 * wording claimed a confirmation the UI never collected; their stored text is
 * left untouched so their proof hashes still verify.
 */
export function generateLiabilityNotice(rulesTriggered: string[]): string {
  if (!rulesTriggered || rulesTriggered.length === 0) {
    return 'Rules triggered: none';
  }
  return `Rules triggered: ${[...rulesTriggered].sort().join(', ')}`;
}
