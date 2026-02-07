// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICloudDreamCore {
    // --- 事件定义 ---
    // --- 事件定义 ---
    event KarmaChanged(address indexed user, uint256 amount, bool isAdd); // 福报变更事件
    event RewardDistributed(address indexed user, uint256 amount, string activeModule); // 奖励发放事件
    event PityTriggered(address indexed user, uint256 amount); // 天道回响事件

    // --- Structs ---
    struct WishRecord {
        uint256 id;
        address user;
        string wishText;
        uint256 timestamp;
        uint256 round;
        uint8 tier;
        uint256 reward;
    }

    struct PityRecord {
        uint256 id;
        address user;
        uint256 amount;
        uint256 timestamp;
    }

    // --- Functions ---
    
    function mintKarma(address user, uint256 amount) external;
    function burnKarma(address user, uint256 amount) external;
    function getUserKarma(address user) external view returns (uint256);

    function addWishRecord(
        address user, 
        string calldata wishText, 
        uint256 round, 
        uint8 tier, 
        uint256 reward
    ) external returns (uint256);

    function addPityRecord(address user, uint256 amount) external;
    function getUserPityIds(address user) external view returns (uint256[] memory);
    
    function incrementPaidSeeks(address user) external;
    function getUserTotalPaidSeeks(address user) external view returns (uint256);
    
    function getWishPowerPool() external view returns (uint256);

    function setTribulationCount(address user, uint256 count) external;
    function getTribulationCount(address user) external view returns (uint256);
    
    function distributeReward(address user, uint256 amount) external;
    function distributeTokenReward(address user, uint256 amount) external;
}
