import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";
import { parse } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// The BOT mainnet deployer key lives in its own file and is read only for the `bot`
// network, so the Monad key in the root .env can never sign a mainnet transaction.
const botKeyFile = join(homedir(), ".secrets", "botchain-mainnet.env");
const rawBotKey = existsSync(botKeyFile) ? parse(readFileSync(botKeyFile)).PRIVATE_KEY?.trim() : undefined;
const botKey = rawBotKey && (rawBotKey.startsWith("0x") ? rawBotKey : `0x${rawBotKey}`);

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        // Kept for reference only. ReceiptRegistry.sol says ^0.8.19, and Hardhat picks the
        // newest configured compiler that satisfies a pragma, so every contract here actually
        // builds with 0.8.24 below. (Native 0.8.19 needs Rosetta on Apple Silicon.)
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
    // BOT Chain's Bohr testnet. Its Blockscout explorer is not on Etherscan V2 or Sourcify;
    // verify with scripts/verify-blockscout.mjs.
    bohr: {
      url: process.env.BOHR_RPC_URL || "https://rpc.bohr.life",
      chainId: 968,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // BOT Chain mainnet (chain 677). Blockscout explorer: verify with scripts/verify-blockscout.mjs.
    bot: {
      url: process.env.BOT_RPC_URL || "https://rpc.botchain.ai",
      chainId: 677,
      accounts: botKey ? [botKey] : [],
    },
  },
  // `npx hardhat verify --network monad <address> [constructor args]` publishes source to
  // Sourcify (MonadVision) and, when ETHERSCAN_API_KEY is set, to MonadScan through the
  // Etherscan V2 API (one key for every chain).
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://testnet.monadvision.com",
  },
  etherscan: {
    enabled: Boolean(process.env.ETHERSCAN_API_KEY),
    apiKey: process.env.ETHERSCAN_API_KEY || "",
    customChains: [
      {
        network: "monad",
        chainId: 10143,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://testnet.monadscan.com",
        },
      },
    ],
  },
};

export default config;
