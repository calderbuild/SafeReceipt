import { ethers } from "hardhat";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  // key is the entry name in wrapper/deployments.json (and wrapper/abi.mjs NETWORKS).
  const KNOWN: Record<number, { key: string; name: string; explorer: string }> = {
    10143: { key: "monad", name: "Monad Testnet", explorer: "https://testnet.monadscan.com" },
    84532: { key: "baseSepolia", name: "Base Sepolia", explorer: "https://sepolia.basescan.org" },
    968: { key: "bohr", name: "BOT Chain Bohr Testnet", explorer: "https://scan.bohr.life" },
    31337: { key: "localhost", name: "Hardhat local", explorer: "(local)" },
  };
  const known = KNOWN[chainId] ?? { key: `chain${chainId}`, name: `Chain ${chainId}`, explorer: "(unknown)" };
  const networkName = known.name;
  const explorer = known.explorer;

  console.log(`Deploying AgentIdentityRegistry + ActionRegistry to ${networkName}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const AgentIdentityRegistry = await ethers.getContractFactory("AgentIdentityRegistry");
  const agentIdentityRegistry = await AgentIdentityRegistry.deploy();
  await agentIdentityRegistry.waitForDeployment();
  const identityAddress = await agentIdentityRegistry.getAddress();
  console.log("AgentIdentityRegistry deployed to:", identityAddress);

  const ActionRegistry = await ethers.getContractFactory("ActionRegistry");
  const actionRegistry = await ActionRegistry.deploy(identityAddress);
  await actionRegistry.waitForDeployment();
  const actionAddress = await actionRegistry.getAddress();
  console.log("ActionRegistry deployed to:", actionAddress);

  const DemoUSD = await ethers.getContractFactory("DemoUSD");
  const demoUSD = await DemoUSD.deploy();
  await demoUSD.waitForDeployment();
  const demoUSDAddress = await demoUSD.getAddress();
  console.log("DemoUSD deployed to:", demoUSDAddress);

  // One file the wrapper reads, keyed by network name.
  const key = known.key;
  const file = join(__dirname, "..", "wrapper", "deployments.json");
  const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  all[key] = {
    ...all[key],
    chainId,
    agentIdentityRegistry: identityAddress,
    actionRegistry: actionAddress,
    demoUSD: demoUSDAddress,
    version: "2.1",
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(file, JSON.stringify(all, null, 2) + "\n");
  console.log(`Wrote ${key} addresses to wrapper/deployments.json`);

  // Verify deployments
  const nextAgentId = await agentIdentityRegistry.nextAgentId();
  const nextReceiptId = await actionRegistry.nextReceiptId();

  console.log("\n=== Deployment Summary ===");
  console.log(`Network: ${networkName} (Chain ID: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`AgentIdentityRegistry: ${identityAddress} (nextAgentId=${nextAgentId})`);
  console.log(`  Explorer: ${explorer}/address/${identityAddress}`);
  console.log(`ActionRegistry: ${actionAddress} (nextReceiptId=${nextReceiptId})`);
  console.log(`  Explorer: ${explorer}/address/${actionAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
