import { ethers } from "ethers";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";
import { AGENT_IDENTITY_ABI, DEPLOYMENTS } from "./abi.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_RAW = "https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/agents";

const AGENTS = ["doc-researcher", "code-reviewer", "security-scanner"];

async function main() {
  const network = process.env.NETWORK || "monad";
  const cfg = DEPLOYMENTS[network];
  if (!cfg) throw new Error(`Unknown network: ${network}`);
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const registry = new ethers.Contract(cfg.agentIdentityRegistry, AGENT_IDENTITY_ABI, signer);

  console.log(`Registering ${AGENTS.length} agents on ${network} (${cfg.agentIdentityRegistry})`);
  console.log(`Controller: ${await signer.getAddress()}\n`);

  const mapping = {};
  for (const name of AGENTS) {
    const tokenURI = `${LEDGER_RAW}/${name}.json`;
    const tx = await registry.registerAgent(tokenURI);
    const rcpt = await tx.wait();
    const ev = rcpt.logs
      .map((l) => { try { return registry.interface.parseLog(l); } catch { return null; } })
      .find((p) => p && p.name === "AgentRegistered");
    const agentId = Number(ev.args.agentId);
    mapping[name] = agentId;
    console.log(`  #${agentId}  ${name}  ->  ${cfg.explorer}/tx/${tx.hash}`);
  }

  const outPath = join(__dirname, `agents.${network}.json`);
  writeFileSync(outPath, JSON.stringify(mapping, null, 2) + "\n");
  console.log(`\nSaved agent id mapping to ${outPath}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
