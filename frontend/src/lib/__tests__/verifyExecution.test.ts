import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { checkApproveExecution } from '../verifyExecution';
import type { MinedTx } from '../verifyExecution';

const TOKEN = '0x5a3b52260c44cd1ec70c7157131bc15913cd835f';
const SPENDER = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const ACTOR = '0x636011edE26fCe9cb675Ac42543d69f3b9CcA9Dc';
const iface = new ethers.Interface(['function approve(address spender, uint256 amount) returns (bool)']);
const intent = { token: TOKEN, spender: SPENDER, amount: '100000000' };

const tx = (over: Partial<MinedTx> = {}, amount = '100000000'): MinedTx => ({
  to: ethers.getAddress(TOKEN),
  from: ACTOR,
  data: iface.encodeFunctionData('approve', [SPENDER, amount]),
  status: 1,
  timestamp: 2000,
  ...over,
});

describe('checkApproveExecution', () => {
  it('verifies a tx that matches the intent exactly', () => {
    expect(checkApproveExecution(tx(), intent, ACTOR, 1000)).toMatchObject({ isVerified: true, mismatchReasons: [] });
  });

  it('flags a tampered amount (the rogue scenario)', () => {
    const r = checkApproveExecution(tx({}, '10000000000'), intent, ACTOR, 1000);
    expect(r.isVerified).toBe(false);
    expect(r.mismatchReasons).toEqual(['Amount mismatch: declared 100000000, executed 10000000000']);
  });

  it('flags a different spender', () => {
    const other = '0x1234567890123456789012345678901234567890';
    const r = checkApproveExecution(tx({ data: iface.encodeFunctionData('approve', [other, '100000000']) }), intent, ACTOR, 1000);
    expect(r.mismatchReasons).toHaveLength(1);
    expect(r.mismatchReasons[0]).toMatch(/^Spender mismatch/);
  });

  it('flags the wrong token contract', () => {
    const r = checkApproveExecution(tx({ to: '0x1234567890123456789012345678901234567890' }), intent, ACTOR, 1000);
    expect(r.mismatchReasons[0]).toMatch(/^Token mismatch/);
  });

  it('flags a reverted tx', () => {
    expect(checkApproveExecution(tx({ status: 0 }), intent, ACTOR, 1000).mismatchReasons).toEqual(['Transaction reverted on-chain']);
  });

  it('flags a tx sent by someone other than the receipt actor', () => {
    const r = checkApproveExecution(tx({ from: '0x1234567890123456789012345678901234567890' }), intent, ACTOR, 1000);
    expect(r.mismatchReasons[0]).toMatch(/^Sender mismatch/);
  });

  it('flags a tx mined before the receipt existed', () => {
    const r = checkApproveExecution(tx({ timestamp: 999 }), intent, ACTOR, 1000);
    expect(r.mismatchReasons).toEqual(['Transaction was mined before the receipt was created']);
  });

  it('flags calldata that is not an approve', () => {
    const r = checkApproveExecution(tx({ data: '0xa9059cbb' }), intent, ACTOR, 1000);
    expect(r.mismatchReasons).toEqual(['Transaction is not an ERC20 approve call']);
  });
});
