// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICloudDreamCore {
    // --- Config Getters ---
    function treasury() external view returns (address);
    function seeker() external view returns (address);
    function drifter() external view returns (address);
    function oracle() external view returns (address);
    
    function protocolFeeRate() external view returns (uint256);
    function protocolFeeRecipient() external view returns (address);
    
    function vrfKeyHash() external view returns (bytes32);
    function vrfSubscriptionId() external view returns (uint64);
    function vrfCallbackGasLimit() external view returns (uint32);
    function vrfRequestConfirmations() external view returns (uint16);

    // --- AccessControl ---
    function hasRole(bytes32 role, address account) external view returns (bool);
    function UPGRADER_ROLE() external view returns (bytes32);
    function CONFIG_ROLE() external view returns (bytes32);
    function OPERATOR_ROLE() external view returns (bytes32);

    // --- Legacy Access (Still needed for events?) ---
    // Events might be emitted by Core or by Modules directly.
    // If Modules emit them, we don't strictly need them here, but good for reference.
    event KarmaChanged(address indexed user, uint256 amount, bool isAdd);
    
    // --- No more distributeReward / mintKarma / etc. in Core Logic ---
    // Core is now just config. Pity/Karma state is in Modules (Drifter/Seeker).
    // Wait, implementation plan says Drifter/Oracle persist data in Proxy Storage.
    // So Core interface is just Config.
}
