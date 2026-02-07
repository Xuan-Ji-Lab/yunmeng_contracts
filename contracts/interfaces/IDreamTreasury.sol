// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDreamTreasury {
    function executeBuyback() external payable;
    function handleAbyssWin(address user, bool isGrandFinale, bool isNewHolder) external returns (uint256);
    function claimDividend() external;
    function getUnclaimedDividend(address user) external view returns (uint256);
}
