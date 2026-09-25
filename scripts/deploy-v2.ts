import { ethers } from "hardhat";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const networkName = chainId === 84532 ? 'Base Sepolia' : chainId === 10143 ? 'Monad Testnet' : `Chain ${chainId}`;
  const explorer = chainId === 84532 ? 'https://sepolia.basescan.org' : 'https://testnet.monadscan.com';

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
  const key = chainId === 84532 ? "baseSepolia" : chainId === 10143 ? "monad" : `chain${chainId}`;
  const file = join(__dirname, "..", "wrapper", "deployments.json");
  const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  all[key] = {
    ...all[key],
    chainId,
    agentIdentityRegistry: identityAddress,
    actionRegistry: actionAddress,
    demoUSD: demoUSDAddress,
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
