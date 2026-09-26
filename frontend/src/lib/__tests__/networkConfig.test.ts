// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { V2_ADDRESSES, V2_NETWORK } from '../v2';
import { DEMO_USD, PERMIT2, KNOWN_CONTRACTS } from '../knownContracts';
import * as server from '../../../api/agent';

// wrapper/deployments.json is written by scripts/deploy-v2.ts; everything else copies from it.
const deployments = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../wrapper/deployments.json', import.meta.url)), 'utf8')).monad;
const lower = (a: string) => a.toLowerCase();

describe('network config has one source of truth', () => {
  it('frontend V2 addresses match the deploy output', () => {
    expect(V2_NETWORK.chainId).toBe(deployments.chainId);
    expect(lower(V2_ADDRESSES.agentIdentityRegistry)).toBe(lower(deployments.agentIdentityRegistry));
    expect(lower(V2_ADDRESSES.actionRegistry)).toBe(lower(deployments.actionRegistry));
    expect(DEMO_USD).toBe(lower(deployments.demoUSD));
  });

  it('the server function uses the same token and spender addresses', () => {
    expect(server.DEMO_USD).toBe(DEMO_USD);
    expect(server.PERMIT2).toBe(PERMIT2);
    expect(server.WMON).toBe(KNOWN_CONTRACTS.find((c) => c.name === 'Wrapped MON')?.address);
  });
});
