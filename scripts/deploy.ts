import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const networkName = chainId === 84532 ? 'Base Sepolia' : chainId === 10143 ? 'Monad Testnet' : `Chain ${chainId}`;
  const explorer = chainId === 84532 ? 'https://sepolia.basescan.org' : 'https://testnet.monadscan.com';

  console.log(`Deploying ReceiptRegistry to ${networkName}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const ReceiptRegistry = await ethers.getContractFactory("ReceiptRegistry");
  const receiptRegistry = await ReceiptRegistry.deploy();

  await receiptRegistry.waitForDeployment();
  const address = await receiptRegistry.getAddress();

  console.log("ReceiptRegistry deployed to:", address);
  console.log("Transaction hash:", receiptRegistry.deploymentTransaction()?.hash);

  // Verify deployment
  const nextReceiptId = await receiptRegistry.nextReceiptId();
  console.log("Initial nextReceiptId:", nextReceiptId.toString());

  console.log("\n=== Deployment Summary ===");
  console.log(`Contract Address: ${address}`);
  console.log(`Network: ${networkName} (Chain ID: ${chainId})`);
  console.log(`Explorer: ${explorer}/address/${address}`);
  console.log(`Deployer: ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
