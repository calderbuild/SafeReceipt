/**
 * Direct deployment script using solc + ethers.js
 * Bypasses Hardhat's compiler download (which requires network access to solc-bin.ethereum.org)
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { ethers } from 'ethers';
import 'dotenv/config';

const require = createRequire(import.meta.url);
const solc = require('solc');

// Compile the contract
const source = readFileSync('contracts/ReceiptRegistry.sol', 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'ReceiptRegistry.sol': { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode.object'] },
    },
  },
};

console.log('Compiling ReceiptRegistry.sol...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors?.some(e => e.severity === 'error')) {
  console.error('Compilation errors:');
  output.errors.filter(e => e.severity === 'error').forEach(e => console.error(e.formattedMessage));
  process.exit(1);
}

const contract = output.contracts['ReceiptRegistry.sol']['ReceiptRegistry'];
const abi = contract.abi;
const bytecode = '0x' + contract.evm.bytecode.object;

console.log('Compilation successful.');
console.log(`ABI: ${abi.length} functions/events`);
console.log(`Bytecode: ${bytecode.length} chars`);

// Deploy
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY not set in .env');
  process.exit(1);
}

console.log(`\nConnecting to Monad Testnet: ${RPC_URL}`);

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log('Deployer address:', wallet.address);

const balance = await provider.getBalance(wallet.address);
console.log('Balance:', ethers.formatEther(balance), 'MON');

if (balance === 0n) {
  console.error('Error: No balance. Get testnet MON from faucet.');
  process.exit(1);
}

console.log('\nDeploying ReceiptRegistry...');

const factory = new ethers.ContractFactory(abi, bytecode, wallet);
const deployed = await factory.deploy();

console.log('Tx hash:', deployed.deploymentTransaction()?.hash);
console.log('Waiting for confirmation...');

await deployed.waitForDeployment();
const address = await deployed.getAddress();

console.log('\n=== Deployment Summary ===');
console.log(`Contract Address: ${address}`);
console.log(`Network: Monad Testnet (Chain ID: 10143)`);
console.log(`Explorer: https://testnet.monadscan.com/address/${address}`);
console.log(`Deployer: ${wallet.address}`);
console.log(`\nUpdate frontend/src/lib/contract.ts with this address.`);
