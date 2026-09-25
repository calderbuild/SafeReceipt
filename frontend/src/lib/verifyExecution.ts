/**
 * Execution verification for APPROVE receipts.
 *
 * checkApproveExecution is pure: given a mined tx and the receipt it claims to
 * fulfil, list every way the tx differs from the declared intent. An empty
 * list means VERIFIED. fetchApproveExecution does the RPC lookups and throws
 * when the tx can't be found, so a lookup failure never reads as MISMATCH.
 */

import { ethers } from 'ethers';

export interface ApproveIntentFields {
  token?: string;
  spender?: string;
  amount?: string;
}

export interface MinedTx {
  to: string | null;
  from: string;
  data: string;
  status: number | null; // receipt status: 1 success, 0 reverted
  timestamp: number; // block timestamp, unix seconds
}

export interface ExecutionCheck {
  isVerified: boolean;
  mismatchReasons: string[];
  decoded?: { spender: string; amount: string };
}

const approveIface = new ethers.Interface(['function approve(address spender, uint256 amount) returns (bool)']);

function decodeApprove(data: string): { spender: string; amount: string } | null {
  try {
    const [spender, amount] = approveIface.decodeFunctionData('approve', data);
    return { spender: String(spender).toLowerCase(), amount: amount.toString() };
  } catch {
    return null;
  }
}

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function checkApproveExecution(
  tx: MinedTx,
  intent: ApproveIntentFields,
  actor: string,
  receiptCreatedAt: number
): ExecutionCheck {
  const reasons: string[] = [];
  if (tx.status !== 1) reasons.push('Transaction reverted on-chain');
  if (!same(tx.from, actor)) reasons.push(`Sender mismatch: receipt actor ${actor}, tx sent by ${tx.from}`);
  if (tx.timestamp < receiptCreatedAt) reasons.push('Transaction was mined before the receipt was created');
  if (!same(tx.to, intent.token)) reasons.push(`Token mismatch: declared ${intent.token}, tx went to ${tx.to}`);

  const decoded = decodeApprove(tx.data);
  if (!decoded) {
    reasons.push('Transaction is not an ERC20 approve call');
  } else {
    if (!same(decoded.spender, intent.spender)) reasons.push(`Spender mismatch: declared ${intent.spender}, executed ${decoded.spender}`);
    if (decoded.amount !== intent.amount) reasons.push(`Amount mismatch: declared ${intent.amount}, executed ${decoded.amount}`);
  }
  return { isVerified: reasons.length === 0, mismatchReasons: reasons, decoded: decoded ?? undefined };
}

export async function fetchApproveExecution(
  provider: ethers.Provider,
  txHash: string,
  intent: ApproveIntentFields,
  actor: string,
  receiptCreatedAt: number
): Promise<ExecutionCheck> {
  const [tx, receipt] = await Promise.all([provider.getTransaction(txHash), provider.getTransactionReceipt(txHash)]);
  if (!tx || !receipt) throw new Error('Transaction not found on chain (not mined yet, or wrong network)');
  const block = await provider.getBlock(receipt.blockNumber);
  if (!block) throw new Error(`Block ${receipt.blockNumber} not found`);
  return checkApproveExecution(
    { to: tx.to, from: tx.from, data: tx.data, status: receipt.status, timestamp: block.timestamp },
    intent,
    actor,
    receiptCreatedAt
  );
}
