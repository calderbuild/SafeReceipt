import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const ACCOUNT = '0x636011edE26fCe9cb675Ac42543d69f3b9CcA9Dc';

// A minimal EIP-1193 wallet: no permission until eth_requestAccounts, on Monad testnet.
function fakeWallet() {
  let granted = false;
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') { granted = true; return [ACCOUNT]; }
      if (method === 'eth_accounts') return granted ? [ACCOUNT] : [];
      if (method === 'eth_chainId') return '0x279f';
      if (method === 'net_version') return '10143';
      throw new Error(`unexpected ${method}`);
    }),
    on: (e: string, cb: (...a: unknown[]) => void) => { (handlers[e] ??= []).push(cb); },
    removeListener: () => {},
  };
}

describe('useWallet', () => {
  it('shares one connection across every component that uses it', async () => {
    (window as unknown as { ethereum: unknown }).ethereum = fakeWallet();
    const { useWallet } = await import('../useWallet');
    const navbar = renderHook(() => useWallet());
    const demo = renderHook(() => useWallet());
    expect(demo.result.current.isConnected).toBe(false);

    await act(() => navbar.result.current.connect());

    await waitFor(() => expect(demo.result.current.isConnected).toBe(true));
    expect(demo.result.current.address).toBe(ACCOUNT);
    expect(demo.result.current.isCorrectNetwork).toBe(true);

    act(() => navbar.result.current.disconnect());
    expect(demo.result.current.isConnected).toBe(false);
  });
});
