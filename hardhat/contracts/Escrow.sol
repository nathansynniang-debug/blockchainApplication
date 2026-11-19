// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Escrow
/// @notice Reverse auction for EV charging. A driver submits the rates offered by
///         charging stations; the station with the lowest price per kWh wins.
///         The driver then pays the winning price into escrow, and the escrow
///         forwards the payment to the winning station.
contract Escrow is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  enum Status {
    None,
    Open, // winner selected, waiting for the driver to pay
    Paid, // paid and forwarded to the station
    Cancelled
  }

  struct Auction {
    address user;
    address station;
    uint256 ratePerKwh; // token base units (wei) per kWh
    uint256 kwh;
    uint256 totalCost; // ratePerKwh * kwh
    uint64 createdAt;
    Status status;
  }

  IERC20 public immutable ethToken;

  /// @notice How long a driver has to pay after the winner is selected.
  uint64 public constant PAYMENT_WINDOW = 15 minutes;

  uint256 public auctionCount;
  mapping(uint256 => Auction) public auctions;
  mapping(address => bool) public isStation;

  event StationRegistered(address indexed station);
  event StationRemoved(address indexed station);
  event AuctionWon(
    uint256 indexed auctionId,
    address indexed user,
    address indexed station,
    uint256 ratePerKwh,
    uint256 kwh,
    uint256 totalCost
  );
  event AuctionPaid(uint256 indexed auctionId, address indexed user, address indexed station, uint256 amount);
  event AuctionCancelled(uint256 indexed auctionId);

  error NotStation(address station);
  error InvalidInput();
  error NotAuctionUser();
  error AuctionNotOpen();
  error PaymentWindowExpired();

  constructor(address token) Ownable(msg.sender) {
    ethToken = IERC20(token);
  }

  // ---------------------------------------------------------------- admin

  function registerStation(address station) external onlyOwner {
    if (station == address(0)) revert InvalidInput();
    isStation[station] = true;
    emit StationRegistered(station);
  }

  function removeStation(address station) external onlyOwner {
    isStation[station] = false;
    emit StationRemoved(station);
  }

  // -------------------------------------------------------------- auction

  /// @param chargingStations   Candidate station wallet addresses (must be registered).
  /// @param amountsCharged     Rate each station charges per kWh (token base units),
  ///                           index-aligned with `chargingStations`.
  /// @param userWantedkWh      kWh the driver wants to charge.
  /// @return auctionId         Id to pass to `payAuction`.
  /// @return winner            Station with the lowest rate (first one wins ties).
  /// @return winningRate       Winning price per kWh.
  /// @return totalCost         winningRate * userWantedkWh.
  function reverseAuction(
    address[] calldata chargingStations,
    uint256[] calldata amountsCharged,
    uint256 userWantedkWh
  ) external returns (uint256 auctionId, address winner, uint256 winningRate, uint256 totalCost) {
    uint256 n = chargingStations.length;
    if (n == 0 || n != amountsCharged.length || userWantedkWh == 0) revert InvalidInput();

    winningRate = type(uint256).max;
    for (uint256 i = 0; i < n; i++) {
      address s = chargingStations[i];
      uint256 rate = amountsCharged[i];
      if (!isStation[s]) revert NotStation(s);
      if (rate == 0) revert InvalidInput();
      if (rate < winningRate) {
        winningRate = rate;
        winner = s;
      }
    }

    totalCost = winningRate * userWantedkWh;
    auctionId = ++auctionCount;
    auctions[auctionId] = Auction({
      user: msg.sender,
      station: winner,
      ratePerKwh: winningRate,
      kwh: userWantedkWh,
      totalCost: totalCost,
      createdAt: uint64(block.timestamp),
      status: Status.Open
    });

    emit AuctionWon(auctionId, msg.sender, winner, winningRate, userWantedkWh, totalCost);
  }

  /// @notice Driver pays the winning station's fee. Requires a prior `approve`
  ///         of at least `totalCost` tokens to this contract.
  function payAuction(uint256 auctionId) external nonReentrant {
    Auction storage a = auctions[auctionId];
    if (a.user != msg.sender) revert NotAuctionUser();
    if (a.status != Status.Open) revert AuctionNotOpen();
    if (block.timestamp > a.createdAt + PAYMENT_WINDOW) revert PaymentWindowExpired();

    a.status = Status.Paid;

    // 1) driver -> escrow
    ethToken.safeTransferFrom(msg.sender, address(this), a.totalCost);
    // 2) escrow -> winning station
    ethToken.safeTransfer(a.station, a.totalCost);

    emit AuctionPaid(auctionId, msg.sender, a.station, a.totalCost);
  }

  function cancelAuction(uint256 auctionId) external {
    Auction storage a = auctions[auctionId];
    if (a.user != msg.sender) revert NotAuctionUser();
    if (a.status != Status.Open) revert AuctionNotOpen();
    a.status = Status.Cancelled;
    emit AuctionCancelled(auctionId);
  }
}
