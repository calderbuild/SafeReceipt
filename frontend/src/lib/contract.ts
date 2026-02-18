import { ethers } from 'ethers';

// Contract ABI - Generated from ReceiptRegistry.sol
export const RECEIPT_REGISTRY_ABI = [
  {
    "inputs": [
      { "internalType": "uint8", "name": "actionType", "type": "uint8" },
      { "internalType": "bytes32", "name": "intentHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "proofHash", "type": "bytes32" },
      { "internalType": "uint8", "name": "riskScore", "type": "uint8" }
    ],
    "name": "createReceipt",
    "outputs": [
      { "internalType": "uint256", "name": "receiptId", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "receiptId", "type": "uint256" },
      { "internalType": "bytes32", "name": "txHash", "type": "bytes32" },
      { "internalType": "bool", "name": "verified", "type": "bool" }
    ],
    "name": "linkExecution",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "receiptId", "type": "uint256" }
    ],
    "name": "getReceipt",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "actor", "type": "address" },
          { "internalType": "uint8", "name": "actionType", "type": "uint8" },
          { "internalType": "uint8", "name": "riskScore", "type": "uint8" },
          { "internalType": "uint40", "name": "timestamp", "type": "uint40" },
          { "internalType": "bytes32", "name": "intentHash", "type": "bytes32" },
          { "internalType": "bytes32", "name": "proofHash", "type": "bytes32" },
          { "internalType": "bytes32", "name": "txHash", "type": "bytes32" },
          { "internalType": "uint8", "name": "status", "type": "uint8" }
        ],
        "internalType": "struct ReceiptRegistry.Receipt",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "getUserReceipts",
    "outputs": [
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextReceiptId",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "receipts",
    "outputs": [
      { "internalType": "address", "name": "actor", "type": "address" },
      { "internalType": "uint8", "name": "actionType", "type": "uint8" },
      { "internalType": "uint8", "name": "riskScore", "type": "uint8" },
      { "internalType": "uint40", "name": "timestamp", "type": "uint40" },
      { "internalType": "bytes32", "name": "intentHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "proofHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "txHash", "type": "bytes32" },
      { "internalType": "uint8", "name": "status", "type": "uint8" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "userReceipts",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "receiptId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "actor", "type": "address" },
      { "indexed": true, "internalType": "uint8", "name": "actionType", "type": "uint8" },
      { "indexed": false, "internalType": "bytes32", "name": "intentHash", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "proofHash", "type": "bytes32" },
      { "indexed": false, "internalType": "uint8", "name": "riskScore", "type": "uint8" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "ReceiptCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "receiptId", "type": "uint256" },
      { "indexed": true, "internalType": "bytes32", "name": "txHash", "type": "bytes32" },
      { "indexed": false, "internalType": "uint8", "name": "status", "type": "uint8" }
    ],
    "name": "ExecutionLinked",
    "type": "event"
  }
] as const;

// Network configurations
export const NETWORKS = {
  monad: {
    chainId: 10143,
    name: 'Monad Testnet',
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    blockExplorer: 'https://testnet.monadscan.com',
    contractAddress: '0x7761871A017c1C703C06B0021bF341d707c6226A',
    nativeCurrency: {
      name: 'MON',
      symbol: 'MON',
      decimals: 18,
    },
  },
  baseSepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
    blockExplorer: 'https://sepolia.basescan.org',
    contractAddress: '0x96D698972c73a0fFe630e67b90e4D1998972f2a0',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
} as const;

// Active network - change this after deploying to Base Sepolia
const ACTIVE_NETWORK: keyof typeof NETWORKS = 'monad';

// Contract configuration
export const CONTRACT_CONFIG = {
  address: NETWORKS[ACTIVE_NETWORK].contractAddress as string,
  abi: RECEIPT_REGISTRY_ABI,
  chainId: NETWORKS[ACTIVE_NETWORK].chainId as number,
};

// Active network config
export const ACTIVE_CHAIN = NETWORKS[ACTIVE_NETWORK];

// Types
export enum ReceiptStatus {
  CREATED = 0,
  EXECUTED = 1,
  VERIFIED = 2,
  MISMATCH = 3,
}

export interface Receipt {
  actor: string;
  actionType: number;
  riskScore: number;
  timestamp: number;
  intentHash: string;
  proofHash: string;
  txHash: string;
  status: ReceiptStatus;
}

export interface ReceiptWithId extends Receipt {
  receiptId: string;
}

export function getStatusLabel(status: ReceiptStatus): string {
  switch (status) {
    case ReceiptStatus.CREATED:
      return 'Created';
    case ReceiptStatus.EXECUTED:
      return 'Executed';
    case ReceiptStatus.VERIFIED:
      return 'Verified';
    case ReceiptStatus.MISMATCH:
      return 'Mismatch';
    default:
      return 'Unknown';
  }
}

export enum ActionType {
  APPROVE = 1,
  BATCH_PAY = 2,
}

// Contract interaction class
export class ReceiptRegistryContract {
  private contract: ethers.Contract | null = null;
  private readOnlyContract: ethers.Contract | null = null;

  constructor(
    private provider: ethers.BrowserProvider | null = null,
    private signer: ethers.JsonRpcSigner | null = null
  ) {
    this.initializeContracts();
  }

  private initializeContracts() {
    if (CONTRACT_CONFIG.address === '0x0000000000000000000000000000000000000000') {
      console.warn('Contract address not set. Please deploy the contract first.');
      return;
    }

    // Read-only contract with provider
    if (this.provider) {
      this.readOnlyContract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        CONTRACT_CONFIG.abi,
        this.provider
      );
    }

    // Write contract with signer
    if (this.signer) {
      this.contract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        CONTRACT_CONFIG.abi,
        this.signer
      );
    }
  }

  // Update provider and signer
  updateProvider(provider: ethers.BrowserProvider | null, signer: ethers.JsonRpcSigner | null) {
    this.provider = provider;
    this.signer = signer;
    this.initializeContracts();
  }

  // Create a new receipt
  async createReceipt(
    actionType: ActionType,
    intentHash: string,
    proofHash: string,
    riskScore: number
  ): Promise<{ receiptId: string; txHash: string }> {
    if (!this.contract) {
      throw new Error('Contract not initialized or signer not available');
    }

    try {
      const tx = await this.contract.createReceipt(
        actionType,
        intentHash,
        proofHash,
        riskScore
      );

      const receipt = await tx.wait();

      // Extract receipt ID from event logs
      const receiptCreatedEvent = receipt.logs.find(
        (log: any) => log.fragment?.name === 'ReceiptCreated'
      );

      if (!receiptCreatedEvent) {
        throw new Error('ReceiptCreated event not found in transaction logs');
      }

      const receiptId = receiptCreatedEvent.args[0].toString();

      return {
        receiptId,
        txHash: receipt.hash,
      };
    } catch (error: any) {
      console.error('Failed to create receipt:', error);
      throw new Error(`Failed to create receipt: ${error.message}`);
    }
  }

  // Get a receipt by ID
  async getReceipt(receiptId: string): Promise<ReceiptWithId> {
    const contract = this.contract || this.readOnlyContract;
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const receipt = await contract.getReceipt(receiptId);

      return {
        receiptId,
        actor: receipt.actor,
        actionType: receipt.actionType,
        riskScore: receipt.riskScore,
        timestamp: Number(receipt.timestamp),
        intentHash: receipt.intentHash,
        proofHash: receipt.proofHash,
        txHash: receipt.txHash,
        status: receipt.status as ReceiptStatus,
      };
    } catch (error: any) {
      console.error('Failed to get receipt:', error);
      throw new Error(`Failed to get receipt: ${error.message}`);
    }
  }

  // Link execution transaction to a receipt
  async linkExecution(
    receiptId: string,
    txHash: string,
    verified: boolean
  ): Promise<{ txHash: string }> {
    if (!this.contract) {
      throw new Error('Contract not initialized or signer not available');
    }

    try {
      const tx = await this.contract.linkExecution(
        receiptId,
        txHash,
        verified
      );

      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
      };
    } catch (error: any) {
      console.error('Failed to link execution:', error);
      throw new Error(`Failed to link execution: ${error.message}`);
    }
  }

  // Get all receipts for a user
  async getUserReceipts(userAddress: string): Promise<string[]> {
    const contract = this.contract || this.readOnlyContract;
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const receiptIds = await contract.getUserReceipts(userAddress);
      return receiptIds.map((id: bigint) => id.toString());
    } catch (error: any) {
      console.error('Failed to get user receipts:', error);
      throw new Error(`Failed to get user receipts: ${error.message}`);
    }
  }

  // Get next receipt ID
  async getNextReceiptId(): Promise<string> {
    const contract = this.contract || this.readOnlyContract;
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const nextId = await contract.nextReceiptId();
      return nextId.toString();
    } catch (error: any) {
      console.error('Failed to get next receipt ID:', error);
      throw new Error(`Failed to get next receipt ID: ${error.message}`);
    }
  }

  // Listen to ReceiptCreated events
  onReceiptCreated(
    callback: (receiptId: string, actor: string, actionType: number, intentHash: string, proofHash: string, riskScore: number, timestamp: number) => void
  ) {
    const contract = this.contract || this.readOnlyContract;
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    contract.on('ReceiptCreated', callback);

    // Return cleanup function
    return () => {
      contract.off('ReceiptCreated', callback);
    };
  }

  // Get contract address
  getAddress(): string {
    return CONTRACT_CONFIG.address;
  }

  // Check if contract is deployed
  isDeployed(): boolean {
    return CONTRACT_CONFIG.address !== '0x0000000000000000000000000000000000000000';
  }
}

// Utility function to create contract instance
export const createReceiptRegistryContract = (
  provider?: ethers.BrowserProvider,
  signer?: ethers.JsonRpcSigner
): ReceiptRegistryContract => {
  return new ReceiptRegistryContract(provider || null, signer || null);
};

// Utility function to get read-only provider
export const getReadOnlyProvider = (): ethers.JsonRpcProvider => {
  return new ethers.JsonRpcProvider(ACTIVE_CHAIN.rpcUrl);
};

// Utility function to format receipt for display
export const formatReceipt = (receipt: ReceiptWithId) => {
  return {
    ...receipt,
    actionTypeString: receipt.actionType === ActionType.APPROVE ? 'Approve' : 'Batch Pay',
    statusString: getStatusLabel(receipt.status),
    timestampFormatted: new Date(receipt.timestamp * 1000).toLocaleString(),
    explorerUrl: `${NETWORKS[ACTIVE_NETWORK].blockExplorer}/tx/${receipt.receiptId}`,
  };
};
