import { DEPLOYER, FLEET_NETS, type AgentProfile, type FleetNet } from './v2';

export const explorer = (address: string, net: FleetNet = 'monad') => `${FLEET_NETS[net].network.blockExplorer}/address/${address}`;
/** Fleet routes: Monad keeps /fleet/..., BOT Chain lives under /fleet/bot/.... */
export const fleetPath = (net: FleetNet, rest = '') => `/fleet${net === 'bot' ? '/bot' : ''}${rest}`;
export const formatTime = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
export const receiptNo = (id: number) => `No. ${String(id).padStart(4, '0')}`;
export const agentName = (agent: AgentProfile | undefined, id: number) => agent?.metadata?.name ?? `Agent #${id}`;
export const isDeployers = (agent: AgentProfile) => agent.owner.toLowerCase() === DEPLOYER.toLowerCase();
