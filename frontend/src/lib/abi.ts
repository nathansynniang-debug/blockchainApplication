// Human-readable ABIs (ethers v6). Kept in sync with hardhat/contracts.
export const ESCROW_ABI = [
  "function reverseAuction(address[] chargingStations, uint256[] amountsCharged, uint256 userWantedkWh) returns (uint256 auctionId, address winner, uint256 winningRate, uint256 totalCost)",
  "function payAuction(uint256 auctionId)",
  "function cancelAuction(uint256 auctionId)",
  "function registerStation(address station)",
  "function removeStation(address station)",
  "function isStation(address) view returns (bool)",
  "function owner() view returns (address)",
  "event AuctionWon(uint256 indexed auctionId, address indexed user, address indexed station, uint256 ratePerKwh, uint256 kwh, uint256 totalCost)",
  "event AuctionPaid(uint256 indexed auctionId, address indexed user, address indexed station, uint256 amount)",
  "error NotStation(address station)",
  "error InvalidInput()",
  "error NotAuctionUser()",
  "error AuctionNotOpen()",
  "error PaymentWindowExpired()",
  "error OwnableUnauthorizedAccount(address account)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
] as const;

export const TOKEN_ABI = [
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function faucet()",
] as const;
