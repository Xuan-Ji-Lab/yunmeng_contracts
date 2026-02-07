// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DreamOracle is Ownable, ReentrancyGuard {
    // 议题结构体
    struct Topic {
        uint256 totalPool; // 总奖池
        uint256[2] optionPools; // 0: A选项池, 1: B选项池
        bool settled; // 是否已结算
        uint8 outcome; // 结果 (0 或 1)
        uint256 endTime; // 截止时间
        string title; // 标题
        string[2] optionLabels; // 选项标签
    }

    mapping(bytes32 => Topic) public topics;
    bytes32[] public allTopicIds; // 存储所有议题ID，便于前端遍历
    mapping(bytes32 => mapping(address => uint256[2])) public userBets; // 用户下注记录
    mapping(bytes32 => mapping(address => bool)) public hasClaimed; // 领奖记录
    
    address public treasury; // 接收手续费地址(通常为 Core 或 Treasury)
    uint256 public constant FEE_RATE = 500; // 5% 手续费

    event TopicCreated(bytes32 indexed topicId, string title);
    event BetPlaced(bytes32 indexed topicId, address indexed user, uint8 option, uint256 amount);
    event WinningsClaimed(bytes32 indexed topicId, address indexed user, uint256 amount);

    constructor(address _treasury) Ownable(msg.sender) {
        treasury = _treasury;
    }

    // --- 管理员操作 ---

    function createTopic(
        string memory _idStr,
        uint256 _duration,
        string memory _title,
        string memory _optA,
        string memory _optB
    ) external onlyOwner {
        bytes32 topicId = keccak256(abi.encodePacked(_idStr));
        require(topics[topicId].endTime == 0, unicode"议题已存在");

        topics[topicId].endTime = block.timestamp + _duration;
        topics[topicId].title = _title;
        topics[topicId].optionLabels[0] = _optA;
        topics[topicId].optionLabels[1] = _optB;

        allTopicIds.push(topicId);

        emit TopicCreated(topicId, _title);
    }

    function getTopicDetails(bytes32 topicId) external view returns (Topic memory) {
        return topics[topicId];
    }

    function getTopicCount() external view returns (uint256) {
        return allTopicIds.length;
    }

    function settleTopic(bytes32 topicId, uint8 outcome) external onlyOwner {
        require(outcome < 2, unicode"无效结果");
        topics[topicId].settled = true;
        topics[topicId].outcome = outcome;
    }

    // --- 用户操作 ---

    function placeBet(bytes32 topicId, uint8 option) external payable nonReentrant {
        Topic storage t = topics[topicId];
        require(block.timestamp < t.endTime, unicode"投注已截止");
        require(option < 2, unicode"无效选项");
        
        uint256 fee = (msg.value * FEE_RATE) / 10000;
        uint256 stake = msg.value - fee;

        if (fee > 0) {
            payable(treasury).transfer(fee);
        }

        t.totalPool += stake;
        t.optionPools[option] += stake;
        userBets[topicId][msg.sender][option] += stake;

        emit BetPlaced(topicId, msg.sender, option, stake);
    }

    function claimWinnings(bytes32 topicId) external nonReentrant {
        Topic storage t = topics[topicId];
        require(t.settled, unicode"未结算");
        require(!hasClaimed[topicId][msg.sender], unicode"已领取");

        uint8 outcome = t.outcome;
        uint256 userStake = userBets[topicId][msg.sender][outcome];
        require(userStake > 0, unicode"未中奖");

        uint256 totalWinPool = t.optionPools[outcome];
        // 计算公式: (用户下注 / 胜方总池) * 总奖池
        uint256 winnings = (userStake * t.totalPool) / totalWinPool;

        hasClaimed[topicId][msg.sender] = true;
        payable(msg.sender).transfer(winnings);

        emit WinningsClaimed(topicId, msg.sender, winnings);
    }
}
