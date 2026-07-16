import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        // V1 ReceiptRegistry.sol -- left untouched, pinned to its original compiler.
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        // V2 contracts (AgentIdentityRegistry.sol, ActionRegistry.sol) -- OpenZeppelin
        // 5.1.x requires ^0.8.24 and its Bytes.sol util uses the Cancun MCOPY opcode.
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "cancun",
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    monad: {
      url: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://base-sepolia-rpc.publicnode.com",
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
