export const REPO_URL = 'https://github.com/calderbuild/SafeReceipt';
const SOURCE_URL = `${REPO_URL}/blob/491afc14455b571412ce4ac2983773906c13db92`;
export const SOURCE_LINKS = {
  registerAgent: `${SOURCE_URL}/wrapper/hosted.mjs#L58`,
  beginAction: `${SOURCE_URL}/wrapper/accountability.mjs#L63`,
  emit: `${SOURCE_URL}/wrapper/accountability.mjs#L49`,
  endAction: `${SOURCE_URL}/wrapper/accountability.mjs#L126`,
  verifyInBrowser: `${SOURCE_URL}/frontend/src/lib/v2.ts#L204`,
  verifyInCLI: `${SOURCE_URL}/wrapper/verify.mjs#L18`,
  quickStartAgent: `${SOURCE_URL}/frontend/public/examples/quick-start-agent.mjs`,
  agentIdentityRegistry: `${SOURCE_URL}/contracts/AgentIdentityRegistry.sol#L14`,
  actionRegistry: `${SOURCE_URL}/contracts/ActionRegistry.sol#L31`,
  receiptRegistry: `${SOURCE_URL}/contracts/ReceiptRegistry.sol#L4`,
};
/** The issue chooser: a bug report or integration feedback (.github/ISSUE_TEMPLATE). */
export const FEEDBACK_URL = `${REPO_URL}/issues/new/choose`;
export const ACCOUNTABILITY_URL = `${REPO_URL}/blob/main/docs/ACCOUNTABILITY.md`;
/** BOT Chain's own site, shown beside the explorer link on the BOT pilot page. */
export const BOT_CHAIN_URL = 'https://botchain.ai';
