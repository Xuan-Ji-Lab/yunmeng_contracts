// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDreamSeeker {
    function isAbyssHolder(address user) external view returns (bool);
    function totalAbyssHolders() external view returns (uint256);
}
