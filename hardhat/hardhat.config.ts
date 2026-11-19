import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.28",
  networks: {
    // In-process simulated chain used by `hardhat test`
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    // The long-running node started with `npx hardhat node` (chain id 31337)
    localhost: { type: "http", chainType: "l1", url: "http://127.0.0.1:8545" },
  },
});
