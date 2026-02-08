// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDreamDrifter {
    function burnKarma(address user, uint256 amount) external;
    function mintKarma(address user, uint256 amount) external;
    function getKarma(address user) external view returns (uint256);
}
