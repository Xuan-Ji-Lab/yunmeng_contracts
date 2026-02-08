// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IDreamTreasury.sol";
import "./interfaces/ICloudDreamCore.sol";

/**
 * @title DreamOracle (问天 - 预测市场 Proxy)
 * @dev 负责处理二元预测(Betting)逻辑。
 *      
 *      机制：
 *      1. **创建议题**: 管理员创建二选一议题 (Topic).
 *      2. **下注**: 用户使用 BNB 对结果进行下注 (Stake)。
 *         - 资金不滞留本合约，全部转发至 Treasury 托管。
 *         - 收取 5% 手续费。
 *      3. **结算**: 管理员输入最终结果。
 *      4. **领奖**: 赢家根据权重瓜分败者池资金 (本金+盈利)。
 */
contract DreamOracle is 
    Initializable, 
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable 
{
    ICloudDreamCore public core;
    IDreamTreasury public treasury;

    // --- 数据结构 ---
    
    struct Topic {
        uint256 totalPool; // 总奖池 (Win + Lose - Fee)
        uint256[2] optionPools; // 选项 A/B 各自池
        bool settled; // 是否已结算
        uint8 outcome; // 结果 (0 或 1)
        uint256 endTime; // 截止时间
        string title; // 标题
        string[2] optionLabels; // 选项标签
    }

    // --- 状态变量 ---

    /// @notice 议题数据存储
    mapping(bytes32 => Topic) public topics;
    
    /// @notice 所有议题 ID 列表
    bytes32[] public allTopicIds;
    
    /// @notice 用户下注记录 [TopicId][User][Option] => Amount
    mapping(bytes32 => mapping(address => uint256[2])) public userBets;
    
    /// @notice 领奖记录 [TopicId][User] => Bool
    mapping(bytes32 => mapping(address => bool)) public hasClaimed;
    
    /// @notice 用户参与过的议题 ID 列表
    mapping(address => bytes32[]) public userParticipatedTopics;
    
    /// @notice 议题的所有参与者 (用于前端展示或批量处理)
    mapping(bytes32 => address[]) public topicParticipants;
    
    // --- 配置参数 ---
    uint256 public feeRate; // 手续费 (基点)

    // --- 事件 ---
    event TopicCreated(bytes32 indexed topicId, string title);
    event BetPlaced(bytes32 indexed topicId, address indexed user, uint8 option, uint256 amount);
    event WinningsClaimed(bytes32 indexed topicId, address indexed user, uint256 amount);
    event FeesForwarded(uint256 amount);
    event TopicSettledNoWinner(bytes32 indexed topicId, uint256 unclaimedAmount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _core, address _treasury) public initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        core = ICloudDreamCore(_core);
        treasury = IDreamTreasury(_treasury);
        feeRate = 500; // 默认 5%
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(
            core.hasRole(core.UPGRADER_ROLE(), msg.sender),
            "Oracle: unauthorized upgrade"
        );
    }

    // --- 管理员操作 (议题管理) ---

    /**
     * @notice 创建新议题
     * @param _duration 持续时间 (秒)
     * @param _title 标题
     * @param _optA 选项A 描述
     * @param _optB 选项B 描述
     */
    function createTopic(
        uint256 _duration,
        string memory _title,
        string memory _optA,
        string memory _optB
    ) external {
        require(
            core.hasRole(core.OPERATOR_ROLE(), msg.sender),
            "Oracle: unauthorized op"
        );
        // 自动生成 ID: Hash(Title + Time + Block + Count)
        bytes32 topicId = keccak256(abi.encodePacked(_title, block.timestamp, block.number, allTopicIds.length));
        require(topics[topicId].endTime == 0, unicode"议题已存在");

        topics[topicId].endTime = block.timestamp + _duration;
        topics[topicId].title = _title;
        topics[topicId].optionLabels[0] = _optA;
        topics[topicId].optionLabels[1] = _optB;

        allTopicIds.push(topicId);
        emit TopicCreated(topicId, _title);
    }
    
    /**
     * @notice 结算议题
     * @param topicId 议题 ID
     * @param outcome 结果 (0 或 1)
     */
    function settleTopic(bytes32 topicId, uint8 outcome) external {
        require(
            core.hasRole(core.OPERATOR_ROLE(), msg.sender),
            "Oracle: unauthorized op"
        );
        require(outcome < 2, unicode"无效结果");
        topics[topicId].settled = true;
        topics[topicId].outcome = outcome;
        
        // check for no winner
        if (topics[topicId].optionPools[outcome] == 0) {
            emit TopicSettledNoWinner(topicId, topics[topicId].totalPool);
        }
    }

    // --- 用户操作 (下注与领奖) ---

    /**
     * @notice 参与预测 (Place Bet)
     * @param topicId 议题 ID
     * @param option 选项 (0 或 1)
     */
    function placeBet(bytes32 topicId, uint8 option) external payable nonReentrant {
        Topic storage t = topics[topicId];
        require(block.timestamp < t.endTime, unicode"投注已截止");
        require(option < 2, unicode"无效选项");
        // 限制：单次议题只能投一方，且不能加注? 
        // 原始逻辑要求: "已参与"则 Revert。即不允许加注。
        require(userBets[topicId][msg.sender][0] == 0 && userBets[topicId][msg.sender][1] == 0, unicode"已参与");
        
        // require(userBets[topicId][msg.sender][0] == 0 && userBets[topicId][msg.sender][1] == 0, unicode"已参与");
        
        uint256 fee = (msg.value * feeRate) / 10000;
        uint256 stake = msg.value - fee;

        // 使用 call 方法转账至 Treasury (支持复杂的 receive 逻辑,避免 gas 限制)
        (bool success, ) = payable(address(treasury)).call{value: msg.value}("");
        require(success, unicode"转账至国库失败");
        emit FeesForwarded(msg.value);

        // 更新状态
        t.totalPool += stake;
        t.optionPools[option] += stake;

        // 首次参与记录
        if (userBets[topicId][msg.sender][0] == 0 && userBets[topicId][msg.sender][1] == 0) {
            userParticipatedTopics[msg.sender].push(topicId);
            topicParticipants[topicId].push(msg.sender);
        }

        userBets[topicId][msg.sender][option] += stake;
        emit BetPlaced(topicId, msg.sender, option, stake);
    }

    /**
     * @notice 领取奖金 (Claim Winnings)
     * @dev 议题结算后，赢家可以调用此函数领取本金+盈利。
     */
    function claimWinnings(bytes32 topicId) external nonReentrant {
        Topic storage t = topics[topicId];
        require(t.settled, unicode"未结算");
        require(!hasClaimed[topicId][msg.sender], unicode"已领取");

        uint8 outcome = t.outcome;
        uint256 userStake = userBets[topicId][msg.sender][outcome];
        require(userStake > 0, unicode"未中奖");

        // 计算奖金: 用户占比 * 总奖池
        uint256 totalWinPool = t.optionPools[outcome];
        uint256 winnings = (userStake * t.totalPool) / totalWinPool;

        hasClaimed[topicId][msg.sender] = true;
        
        // 从 Treasury 请求支付 BNB
        treasury.payoutBNB(msg.sender, winnings);

        emit WinningsClaimed(topicId, msg.sender, winnings);
    }

    // --- 视图 ---
    /**
     * @notice 获取议题详情
     */
    function getTopicDetails(bytes32 topicId) external view returns (Topic memory) { return topics[topicId]; }
    
    /**
     * @notice 获取议题总数
     */
    function getTopicCount() external view returns (uint256) { return allTopicIds.length; }
    
    /**
     * @notice 获取用户参与的议题数量
     */
    function getUserTopicCount(address user) external view returns (uint256) { return userParticipatedTopics[user].length; }
    
    /**
     * @notice 获取用户参与的所有议题 ID
     */
    function getUserTopicIds(address user) external view returns (bytes32[] memory) { return userParticipatedTopics[user]; }
    
    /**
     * @notice 获取议题的所有参与者地址
     */
    function getTopicParticipants(bytes32 topicId) external view returns (address[] memory) { return topicParticipants[topicId]; }
    
    /**
     * @notice 设置国库合约地址 (需 CONFIG_ROLE)
     */
    function setTreasury(address _treasury) external {
        require(
            core.hasRole(core.CONFIG_ROLE(), msg.sender),
            "Oracle: unauthorized config"
        );
        treasury = IDreamTreasury(_treasury);
    }
    
    /**
     * @notice 设置手续费率 (需 CONFIG_ROLE)
     * @param _rate 费率基点 (max 10000)
     */
    function setFeeRate(uint256 _rate) external {
        require(
            core.hasRole(core.CONFIG_ROLE(), msg.sender),
            "Oracle: unauthorized config"
        );
        require(_rate <= 10000, "Invalid rate");
        feeRate = _rate;
    }
}
