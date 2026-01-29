/**
 * Execute Intent
 *
 * Actually executes the on-chain transaction described by a receipt.
 * In mock mode, returns a simulated tx hash with artificial delay.
 */

import { ethers } from 'ethers';
import { CONTRACT_CONFIG } from './contract';

const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

/**
 * Execute an ERC20 approve transaction
 */
export async function executeApprove(
  signer: ethers.JsonRpcSigner,
  token: string,
  spender: string,
  amount: string
): Promise<string> {
  // Mock mode: contract not deployed
  if (CONTRACT_CONFIG.address === '0x0000000000000000000000000000000000000000') {
    return mockExecuteApprove();
  }

  const tokenContract = new ethers.Contract(token, ERC20_ABI, signer);
  const tx = await tokenContract.approve(spender, amount);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Mock execution with realistic delay
 */
async function mockExecuteApprove(): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 2000));
  // Generate a deterministic-looking mock tx hash
  const randomBytes = ethers.randomBytes(32);
  return ethers.hexlify(randomBytes);
}
