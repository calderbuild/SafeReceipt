import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ReceiptRegistry to Monad testnet...");
  
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
  console.log(`Network: Monad Testnet (Chain ID: 10143)`);
  console.log(`Explorer: https://testnet.monadscan.com/address/${address}`);
  console.log(`Deployer: ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
