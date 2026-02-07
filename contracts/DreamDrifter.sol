// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ICloudDreamCore.sol";

contract DreamDrifter is Ownable {
    ICloudDreamCore public core;

    // 听澜状态
    mapping(address => uint256) public resonanceCount; // 共鸣次数
    mapping(address => mapping(address => bool)) public hasResonatedWith; // 是否已共鸣
    mapping(address => uint256) public dailyResonanceDate; // 每日共鸣日期
    mapping(address => uint256) public dailyResonanceCount; // 每日消耗次数

    struct ResonanceRecord {
        uint256 id;
        address source;
        address target;
        string message;
        uint256 timestamp;
    }

    ResonanceRecord[] public allResonances;
    mapping(address => uint256[]) public userOutboundResonances;
    mapping(address => uint256[]) public userInboundResonances;

    uint256 public constant DAILY_RESONANCE_LIMIT = 3; // 每日上限
    uint256 public constant KARMA_PER_LISTEN = 1; // 每次共鸣奖励

    // 事件
    event ReferrerBound(address indexed user, address indexed referrer, string message); // 绑定邀请人
    event ResonanceRecorded(address indexed source, address indexed target); // 共鸣记录

    constructor(address _core) Ownable(msg.sender) {
        core = ICloudDreamCore(_core);
    }

    // --- 核心逻辑 ---

    /**
     * @notice 响应 (Respond to Echo)
     * @dev 响应他人的分享，增加共鸣次数并奖励邀请人
     */
    function respondToEcho(address referrer, string memory message) external {
        require(referrer != address(0), unicode"无效推荐人");
        require(referrer != msg.sender, unicode"不能推荐自己");
        require(!hasResonatedWith[msg.sender][referrer], unicode"已与该用户共鸣");
        
        // 1. 每日上限检查
        uint256 today = block.timestamp / 1 days;
        if (dailyResonanceDate[msg.sender] != today) {
            dailyResonanceDate[msg.sender] = today;
            dailyResonanceCount[msg.sender] = 0;
        }
        require(dailyResonanceCount[msg.sender] < DAILY_RESONANCE_LIMIT, unicode"每日上限已达");

        // 2. 更新状态
        hasResonatedWith[msg.sender][referrer] = true;
        resonanceCount[msg.sender]++;
        dailyResonanceCount[msg.sender]++;

        // 记录存档
        uint256 newId = allResonances.length;
        allResonances.push(ResonanceRecord({
            id: newId,
            source: msg.sender,
            target: referrer,
            message: message,
            timestamp: block.timestamp
        }));
        userOutboundResonances[msg.sender].push(newId);
        userInboundResonances[referrer].push(newId);

        // 3. 奖励推荐人 (调用 Core 铸造福报)
        core.mintKarma(referrer, KARMA_PER_LISTEN);

        emit ReferrerBound(msg.sender, referrer, message);
        emit ResonanceRecorded(msg.sender, referrer);
    }

    // --- 管理员 ---
    function setCore(address _core) external onlyOwner {
        core = ICloudDreamCore(_core);
    }
}
