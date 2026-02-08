// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/ICloudDreamCore.sol";
import "./interfaces/IDreamDrifter.sol";
import "./interfaces/IDreamSeeker.sol";

/**
 * @title DreamDrifter (听澜 - 社交与福报 Proxy)
 * @dev 负责处理系统的社交互动(共鸣)和积分(福报)系统。
 *      
 *      核心功能：
 *      1. **福报 (Karma)**: 用户通过互动通过积累的积分，可用于免费寻真。
 *         - 数据存储在本合约。
 *      2. **共鸣 (Resonance)**: 分享邀请机制。
 *         - 用户可以响应其他人的邀请 (Link/Referral)。
 *         - 响应者和分享者都能获得福报奖励。
 */
contract DreamDrifter is 
    Initializable, 
    UUPSUpgradeable
{
    ICloudDreamCore public core;
    address public seeker; // 授权 Seeker 合约扣除福报

    // --- 听澜共鸣状态 ---
    
    /// @notice 用户总共鸣次数
    mapping(address => uint256) public resonanceCount;
    
    /// @notice 记录两个用户是否已产生过共鸣 (A响应过B)
    mapping(address => mapping(address => bool)) public hasResonatedWith;
    
    /// @notice 用户最后一次共鸣的日期 (用于每日限制)
    mapping(address => uint256) public dailyResonanceDate;
    
    /// @notice 用户当日共鸣计数
    mapping(address => uint256) public dailyResonanceCount;

    // --- 福报系统 (Karma) ---
    /// @notice 用户福报余额
    mapping(address => uint256) public karmaBalance;

    struct ResonanceRecord {
        uint256 id;
        address source; // 响应者 (谁点的)
        address target; // 被响应者 (Referrer)
        string message;
        uint256 timestamp;
        uint256 amount; // 产生的福报值
    }

    /// @notice 全局共鸣记录
    ResonanceRecord[] public allResonances;
    
    /// @notice 用户发出的共鸣 ID 列表
    mapping(address => uint256[]) public userOutboundResonances; 
    
    /// @notice 用户收到的共鸣 ID 列表
    mapping(address => uint256[]) public userInboundResonances; 

    // --- 配置参数 (Configurable) ---
    uint256 public inviteThreshold; // 邀请门槛 (付费次数)
    uint256 public dailyLimit;      // 每日上限 (State Var)
    uint256 public karmaReward;     // 单次奖励 (State Var)

    // --- 事件 ---
    event ReferrerBound(address indexed user, address indexed referrer, string message);
    event ResonanceRecorded(address indexed source, address indexed target);
    event KarmaChanged(address indexed user, uint256 amount, bool isAdd);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _core) public initializer {
        __UUPSUpgradeable_init();
        core = ICloudDreamCore(_core);
        
        // 默认配置
        inviteThreshold = 1; // 至少付费1次
        dailyLimit = 3;
        karmaReward = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        // 通过 Core 检查升级权限
        require(
            core.hasRole(core.UPGRADER_ROLE(), msg.sender), 
            "Drifter: unauthorized upgrade"
        );
    }

    // --- 福报操作接口 (供 Seeker 调用) ---
    
    modifier onlySeeker() {
        require(msg.sender == seeker, unicode"仅限 Seeker");
        _;
    }

    /**
     * @notice 销毁(消耗)福报
     * @dev 仅允许 Seeker 合约在用户进行免费寻真时调用。
     */
    function burnKarma(address user, uint256 amount) external onlySeeker {
        require(karmaBalance[user] >= amount, unicode"福报不足");
        karmaBalance[user] -= amount;
        emit KarmaChanged(user, amount, false);
    }
    
    // --- 听澜共鸣核心逻辑 ---
    
    /**
     * @notice 响应共鸣 (Respond to Echo)
     * @dev 用户通过点击链接/分享响应他人。
     *      限制：不能自己响应自己，每日限额，不能重复响应同一人。
     * @param referrer 推荐人/分享者地址
     * @param message 附言
     */
    function respondToEcho(address referrer, string memory message) external {
        require(referrer != address(0), unicode"无效对象");
        require(referrer != msg.sender, unicode"不能自嗨");
        require(!hasResonatedWith[msg.sender][referrer], unicode"已共鸣");
        
        // 校验 Referrer 有效性 (必须是付费用户且满足门槛)
        // require(IDreamSeeker(seeker).hasPaid(referrer), unicode"无效推荐人");
        require(IDreamSeeker(seeker).getUserWishCount(referrer) >= inviteThreshold, unicode"未达邀请门槛");

        // 检查每日限制
        uint256 today = block.timestamp / 1 days;
        if (dailyResonanceDate[msg.sender] != today) {
            dailyResonanceDate[msg.sender] = today;
            dailyResonanceCount[msg.sender] = 0;
        }
        require(dailyResonanceCount[msg.sender] < dailyLimit, unicode"今日共鸣已达上限");

        // 更新状态
        hasResonatedWith[msg.sender][referrer] = true;
        resonanceCount[msg.sender]++;
        dailyResonanceCount[msg.sender]++;

        // 发放奖励 (Mint Karma -> Referrer)
        karmaBalance[referrer] += karmaReward;
        emit KarmaChanged(referrer, karmaReward, true);

        // 记录历史
        uint256 newId = allResonances.length;
        allResonances.push(ResonanceRecord({
            id: newId,
            source: msg.sender,
            target: referrer,
            message: message,
            timestamp: block.timestamp,
            amount: karmaReward
        }));
        
        userOutboundResonances[msg.sender].push(newId);
        userInboundResonances[referrer].push(newId);

        emit ReferrerBound(msg.sender, referrer, message);
        emit ResonanceRecorded(msg.sender, referrer);
    }

    // --- 配置 ---
    /**
     * @notice 设置核心合约地址 (需 CONFIG_ROLE)
     */
    function setConfig(address _core, address _seeker) external {
        // 通过 Core 检查配置权限
        require(
            core.hasRole(core.CONFIG_ROLE(), msg.sender),
            "Drifter: unauthorized config"
        );
        core = ICloudDreamCore(_core);
        seeker = _seeker;
    }
    
    /**
     * @notice 设置听澜参数 (需 CONFIG_ROLE)
     * @param _dailyLimit 每日共鸣上限
     * @param _karmaReward 单次共鸣奖励福报
     * @param _inviteThreshold 邀请门槛 (受邀者需至少付费 N 次)
     */
    function setDrifterConfig(
        uint256 _dailyLimit, 
        uint256 _karmaReward,
        uint256 _inviteThreshold
    ) external {
        require(
            core.hasRole(core.CONFIG_ROLE(), msg.sender),
            "Drifter: unauthorized config"
        );
        dailyLimit = _dailyLimit;
        karmaReward = _karmaReward;
        inviteThreshold = _inviteThreshold;
    }
    
    // --- 视图 ---
    /**
     * @notice 查询用户福报余额
     */
    function getKarma(address user) external view returns (uint256) {
        return karmaBalance[user];
    }
}
