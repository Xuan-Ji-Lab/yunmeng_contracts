// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDreamTreasury {
    function wishToken() external view returns (address);
    function payoutToken(address to, uint256 amount) external;
    function payoutBNB(address to, uint256 amount) external;
    function executeBuyback(uint256 amountIn) external;
}
