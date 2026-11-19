import { BrowserProvider, Contract, JsonRpcProvider, type ContractRunner, type JsonRpcSigner } from "ethers";
import deployment from "@/contracts/deployment.json";
import { ESCROW_ABI, TOKEN_ABI } from "./abi";

type Eip1193 = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, cb: (...args: any[]) => void): void;
  removeListener?(event: string, cb: (...args: any[]) => void): void;
};
declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
export const CHAIN_ID = deployment.chainId;
export const CHAIN_HEX = "0x" + CHAIN_ID.toString(16);
export const ESCROW_ADDRESS = deployment.escrow;
export const TOKEN_ADDRESS = deployment.token;
export const OWNER_ADDRESS = deployment.owner;
export const CONTRACTS_DEPLOYED = !/^0x0+$/.test(deployment.escrow);

// Read-only provider that does not need a wallet.
export const readProvider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });

export const getEscrow = (runner: ContractRunner = readProvider) => new Contract(ESCROW_ADDRESS, ESCROW_ABI, runner);
export const getToken = (runner: ContractRunner = readProvider) => new Contract(TOKEN_ADDRESS, TOKEN_ABI, runner);

async function ensureChain(eth: Eip1193) {
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (e: any) {
    // 4902 = chain unknown to the wallet. MetaMask sometimes wraps it as -32603.
    if (e?.code === 4902 || e?.code === -32603) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_HEX,
          chainName: "Hardhat Local",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [RPC_URL],
        }],
      });
    } else {
      throw e;
    }
  }
}

/** Opens the wallet popup (if needed), switches to the local chain, returns a signer. */
export async function connectWallet(): Promise<{ signer: JsonRpcSigner; address: string }> {
  const eth = window.ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask or another browser wallet, then reload.");
  await eth.request({ method: "eth_requestAccounts" });
  await ensureChain(eth);
  const provider = new BrowserProvider(eth); // created after the chain switch so ethers sees the right network
  const signer = await provider.getSigner();
  return { signer, address: await signer.getAddress() };
}

const REVERTS: Record<string, string> = {
  NotStation: "A station in the list isn't registered on-chain yet. Ask an admin to register it.",
  InvalidInput: "The auction needs at least one station, a rate for each, and more than 0 kWh.",
  NotAuctionUser: "This auction belongs to a different wallet.",
  AuctionNotOpen: "This auction is already paid or cancelled.",
  PaymentWindowExpired: "The 15-minute payment window ended. Start a new auction.",
  OwnableUnauthorizedAccount: "Only the contract owner can do this. Switch to Hardhat account #0.",
  ERC20InsufficientBalance: "Not enough EVC in this wallet. Use the faucet to get more.",
  ERC20InsufficientAllowance: "The escrow isn't approved to spend enough EVC.",
};

export function explainError(e: unknown): string {
  const err = e as any;
  if (err?.code === "ACTION_REJECTED" || err?.code === 4001) return "You rejected the request in your wallet.";
  const name: string | undefined = err?.revert?.name;
  if (name && REVERTS[name]) return REVERTS[name];
  return err?.reason || err?.shortMessage || err?.message || "Something went wrong.";
}

export const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
