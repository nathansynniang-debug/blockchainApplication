// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title EVCToken
/// @notice Demo ERC-20 used to pay for EV charging sessions on a local network.
///         The built-in faucet lets any test wallet mint tokens for itself.
contract EVCToken is ERC20 {
  uint256 public constant FAUCET_AMOUNT = 1_000 ether;
  uint256 public constant FAUCET_COOLDOWN = 1 hours;

  mapping(address => uint256) public lastFaucetClaim;

  constructor() ERC20("EV Charge Token", "EVC") {
    _mint(msg.sender, 1_000_000 ether);
  }

  function faucet() external {
    require(
      block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN,
      "Faucet: wait before claiming again"
    );
    lastFaucetClaim[msg.sender] = block.timestamp;
    _mint(msg.sender, FAUCET_AMOUNT);
  }
}
