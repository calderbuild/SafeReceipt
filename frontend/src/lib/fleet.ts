import { DEPLOYER, V2_NETWORK, type AgentProfile } from './v2';

export const explorer = (address: string) => `${V2_NETWORK.blockExplorer}/address/${address}`;
export const formatTime = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
export const receiptNo = (id: number) => `No. ${String(id).padStart(4, '0')}`;
export const agentName = (agent: AgentProfile | undefined, id: number) => agent?.metadata?.name ?? `Agent #${id}`;
export const isDeployers = (agent: AgentProfile) => agent.owner.toLowerCase() === DEPLOYER.toLowerCase();
