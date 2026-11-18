import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import { AccountabilityClient, DEPLOYMENTS, evaluatePolicy, receiptURL, registerAgent } from '@safereceipt/client';

const network = 'monad';
const input = 'orders.json';
const declaredIntent = {
  goal: 'Count sample orders and total their amounts',
  declaredScope: [input],
};

function summarize(client) {
  const orders = JSON.parse(readFileSync(input, 'utf8'));
  if (!Array.isArray(orders) || orders.some((order) => !Number.isSafeInteger(order?.amount))) {
    throw new Error('orders.json must contain a list of orders with integer amounts');
  }
  client.emit('read', `Read ${input}`, 40, { touched: [input] });
  const result = { orders: orders.length, total: orders.reduce((total, order) => total + order.amount, 0) };
  client.emit('summarize', 'Counted orders and totaled their amounts', 90, result);
  console.log(`[3] Executed: ${result.orders} orders, total ${result.total}`);
}

if (process.env.SAFERECEIPT_SEND !== '1') {
  console.log('Dry run on Monad testnet: no wallet, upload, or transaction');
  summarize(new AccountabilityClient({ network, signer: null }));
} else {
  const privateKey = readFileSync('.env', 'utf8').match(/^PRIVATE_KEY=(0x[a-f0-9]{64})\s*$/im)?.[1];
  if (!privateKey) throw new Error('Create the test wallet in this folder first');
  const provider = new ethers.JsonRpcProvider(DEPLOYMENTS[network].rpc);
  const signer = new ethers.Wallet(privateKey, provider);
  if (await provider.getBalance(signer.address) === 0n) throw new Error('Claim Monad testnet MON for this wallet before continuing');

  let agentId = Number(process.env.AGENT_ID ?? '0');
  if (!Number.isSafeInteger(agentId) || agentId < 0) throw new Error('AGENT_ID must be a valid agent number');
  if (!agentId) {
    ({ agentId } = await registerAgent(signer, { name: 'order-totals', role: 'Summarizes sample orders', model: 'none' }, { network }));
  }
  console.log(`[1] Agent #${agentId} (set AGENT_ID=${agentId} to reuse it)`);

  const client = new AccountabilityClient({ network, signer });
  const { receiptId } = await client.beginAction({ agentId, declaredIntent });
  console.log(`[2] Receipt #${receiptId} opened`);

  try {
    summarize(client);
  } catch (error) {
    client.emit('error', 'Could not summarize the sample orders', 90, { error: true });
    console.error(error instanceof Error ? error.message : 'Could not read orders.json');
  }

  const policyResult = evaluatePolicy(client.buildTrace(null));
  const result = await client.endAction({ policyResult });
  console.log(`[4] Result linked: ${result.status}`);
  console.log(`[5] Open ${receiptURL(receiptId, network)} and press Verify independently`);
}
