// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { Escrow } from "./Escrow.sol";
import { EVCToken } from "./EVCToken.sol";

contract EscrowTest is Test {
  Escrow escrow;
  EVCToken token;

  address user = address(0xA11CE);
  address stationA = address(0xA);
  address stationB = address(0xB);
  address stationC = address(0xC);

  function setUp() public {
    token = new EVCToken();
    escrow = new Escrow(address(token));
    escrow.registerStation(stationA);
    escrow.registerStation(stationB);
    escrow.registerStation(stationC);
    token.transfer(user, 1_000 ether);
  }

  function _bids() internal view returns (address[] memory s, uint256[] memory r) {
    s = new address[](3);
    r = new uint256[](3);
    s[0] = stationA; r[0] = 0.50 ether;
    s[1] = stationB; r[1] = 0.35 ether;
    s[2] = stationC; r[2] = 0.42 ether;
  }

  function test_LowestRateWins() public {
    (address[] memory s, uint256[] memory r) = _bids();
    vm.prank(user);
    (, address winner, uint256 rate, uint256 cost) = escrow.reverseAuction(s, r, 10);
    assertEq(winner, stationB);
    assertEq(rate, 0.35 ether);
    assertEq(cost, 3.5 ether);
  }

  function test_RevertsForUnregisteredStation() public {
    (address[] memory s, uint256[] memory r) = _bids();
    s[1] = address(0xBAD);
    vm.prank(user);
    vm.expectRevert(abi.encodeWithSelector(Escrow.NotStation.selector, address(0xBAD)));
    escrow.reverseAuction(s, r, 10);
  }

  function test_PayForwardsTokensToWinner() public {
    (address[] memory s, uint256[] memory r) = _bids();
    vm.startPrank(user);
    (uint256 id, , , uint256 cost) = escrow.reverseAuction(s, r, 10);
    token.approve(address(escrow), cost);
    escrow.payAuction(id);
    vm.stopPrank();

    assertEq(token.balanceOf(stationB), cost);
    assertEq(token.balanceOf(address(escrow)), 0);
    assertEq(token.balanceOf(user), 1_000 ether - cost);
  }

  function test_CannotPayAfterWindow() public {
    (address[] memory s, uint256[] memory r) = _bids();
    vm.startPrank(user);
    (uint256 id, , , uint256 cost) = escrow.reverseAuction(s, r, 10);
    token.approve(address(escrow), cost);
    vm.warp(block.timestamp + 16 minutes);
    vm.expectRevert(Escrow.PaymentWindowExpired.selector);
    escrow.payAuction(id);
    vm.stopPrank();
  }
}
